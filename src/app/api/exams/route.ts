import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/video-guard'
import { ensureExamSettingsColumns } from '@/lib/ensure-schema'

// ============================================================
// توزيع النماذج العشوائي (طلب المستر): لما الامتحان يكون فيه نماذج كتير
// (نموذج أ / نموذج ب ...) الطالب بيشوف **نموذج واحد بس** — عشوائي لكن
// **ثابت لحسابه** (نفس الطالب + نفس الامتحان = نفس النموذج دايمًا).
// الاختيار بيبقى **على السيرفر** — أسئلة النماذج التانية مش بتوصل للطالب أصلًا.
// ============================================================
function pickModelIdx(examId: string, studentId: string, n: number): number {
  var s = String(examId) + '|' + String(studentId)
  var h = 5381
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return n > 0 ? h % n : 0
}
function applyModelForStudent(exam: any, studentId: string) {
  try {
    var models = exam && exam.models ? JSON.parse(exam.models) : []
    if (!Array.isArray(models) || models.length === 0) return exam
    /* (2026-و) طلب المستر: "ما يكونش أساسًا إنه عشوائي — ممكن أحط عشوائي
       ممكن أحط نموذج واحد بس" → لو المستر اختار "نموذج ثابت" كل الطلاب
       بيشوفوا **نفس النموذج** اللي هو حدده (fixedModel)، ولو عشوائي
       يفضل الوضع القديم (نموذج ثابت لكل حساب بالهاش) */
    var idx = -1
    if (exam.modelMode === 'fixed' && exam.fixedModel) {
      for (var f = 0; f < models.length; f++) {
        if (models[f] && models[f].name === exam.fixedModel) { idx = f; break }
      }
      if (idx < 0) idx = 0 /* النموذج المحدد اتمسح → الأول */
    } else {
      idx = pickModelIdx(exam.id, studentId, models.length)
    }
    var m = models[idx]
    if (!m) return exam
    // **مهم**: بنشيل حقل النماذج كله من الرد — أسئلة النماذج التانية
    // ما بتوصلش للطالب أصلًا (مفصولين فعليًا مش شكليًا)
    var out: any = { ...exam }
    delete out.models
    return {
      ...out,
      questions: m.questions ? (typeof m.questions === 'string' ? m.questions : JSON.stringify(m.questions)) : exam.questions,
      filePath: m.filePath || '',
      fileType: m.fileType || '',
      modelName: m.name || ('النموذج ' + (idx + 1)),
      modelsCount: models.length,
    }
  } catch (e) {
    return exam
  }
}

/* (2026-و25 نقل 25-b1) هل الامتحان مجدول في المستقبل؟ — للأدمن بادج «مجدول» */
function isScheduledFuture(e: any): boolean {
  try {
    if (!e || !e.scheduledAt) return false
    return new Date(e.scheduledAt).getTime() > Date.now()
  } catch { return false }
}

export async function GET(request: NextRequest) {
  try {
    // (2026-و25 نقل 25-b1) defensive ALTERs — أي قاعدة بيانات بتترقّى أول ريكوست
    await ensureExamSettingsColumns(function (sql: string) { return db.$executeRawUnsafe(sql) })

    const { searchParams } = new URL(request.url)
    const grade = searchParams.get('grade')
    const keyword = searchParams.get('keyword')
    // لو الطلب من حساب طالب → امسح له النموذج المخصص عشوائيًا
    const studentId = searchParams.get('studentId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    // (2026-و25 نقل 25-b1) فلترة المجدول: غير الأدمن مش بيشوف الامتحانات
    // اللي موعد ظهورها في المستقبل خالص (متنزلش أصلًا) — الأدمن بيشوف الكل
    const adminId = searchParams.get('adminId') || ''
    const admin = await isAdmin(adminId)

    const where: Record<string, unknown> = {}
    if (grade) where.grade = grade
    if (keyword) {
      where.OR = [{ title: { contains: keyword } }]
    }
    if (!admin) {
      where.AND = [{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] }]
    }

    const [exams, total] = await Promise.all([
      db.exam.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.exam.count({ where }),
    ])

    // بادج «مجدول» للأدمن على العناصر المستقبلية
    const flagged = admin
      ? exams.map(function (e: any) { return isScheduledFuture(e) ? { ...e, scheduled: true } : e })
      : exams

    // توزيع النموذج للطالب (عشوائي ثابت أو نموذج واحد ثابت للكل حسب اختيار
    // المستر) — وإلا الامتحان زي ما هو
    const outExams = studentId ? flagged.map(function (e: any) { return applyModelForStudent(e, studentId) }) : flagged

    return NextResponse.json({ exams: outExams, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (error: any) {
    console.error('Exams fetch error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureExamSettingsColumns(function (sql: string) { return db.$executeRawUnsafe(sql) })

    const body = await request.json()
    const { title, content, grade, filePath, fileType, questions, models, modelMode, fixedModel, passScore, answerKeyPath, answerKeyType, thumbnail } = body

    if (!title || !grade) {
      return NextResponse.json({ error: 'Title and grade are required' }, { status: 400 })
    }

    // (2026-و25 نقل 25-b1) إعدادات الامتحان الجديدة — سوتش إظهار الإجابات +
    // مؤقت بالدقائق (فاضي/سالب → 0) + موعد الظهور (ISO|null)
    var showResult = body.showResult === true || body.showResult === 'true' || body.showResult === 1
    var timeLimitMin = parseInt(String(body.timeLimitMin ?? ''), 10)
    if (isNaN(timeLimitMin) || timeLimitMin < 0) timeLimitMin = 0
    var scheduledAt: Date | null = null
    if (body.scheduledAt) {
      try {
        var sd = new Date(String(body.scheduledAt))
        if (!isNaN(sd.getTime())) scheduledAt = sd
      } catch (e) { scheduledAt = null }
    }

    const exam = await db.exam.create({
      data: {
        title,
        content: content || '',
        grade,
        filePath: filePath || '',
        fileType: fileType || '',
        answerKeyPath: answerKeyPath || '',
        answerKeyType: answerKeyType || '',
        thumbnail: thumbnail || '',
        questions: questions || '',
        models: models || '',
        modelMode: modelMode === 'fixed' ? 'fixed' : 'random',
        fixedModel: (modelMode === 'fixed' && fixedModel) ? String(fixedModel) : '',
        passScore: passScore ? parseFloat(passScore) : 50,
        showResult,
        timeLimitMin,
        scheduledAt,
      },
    })

    return NextResponse.json({ message: 'Exam added', exam }, { status: 201 })
  } catch (error: any) {
    console.error('Exam create error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}
