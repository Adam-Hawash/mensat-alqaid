import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/video-guard'
import { ensureExamSettingsColumns } from '@/lib/ensure-schema'

/* (2026-و25 نقل 25-b1) هل الواجب مجدول في المستقبل؟ — للأدمن بادج «مجدول» */
function isScheduledFuture(h: any): boolean {
  try {
    if (!h || !h.scheduledAt) return false
    return new Date(h.scheduledAt).getTime() > Date.now()
  } catch { return false }
}

/* (2026-و26) قراءة قايمة الاستهداف من صف */
function parseTargetIds(raw: unknown): string[] {
  try { var p = JSON.parse(String(raw || '[]')); return Array.isArray(p) ? p : [] } catch (e) { return [] }
}

export async function GET(request: NextRequest) {
  try {
    // (2026-و25 نقل 25-b1) defensive ALTERs — أي قاعدة بيانات بتترقّى أول ريكوست
    await ensureExamSettingsColumns(function (sql: string) { return db.$executeRawUnsafe(sql) })

    const { searchParams } = new URL(request.url)
    const grade = searchParams.get('grade')
    const keyword = searchParams.get('keyword')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    // (2026-و25 نقل 25-b1) فلترة المجدول: غير الأدمن مش بيشوف الواجبات
    // اللي موعد ظهورها في المستقبل خالص — والأدمن بيشوفهم ببادج
    const adminId = searchParams.get('adminId') || ''
    const admin = await isAdmin(adminId)
    /* (2026-و26) طالب محدد؟ (للفلترة حسب الاستهداف) */
    const studentId = searchParams.get('studentId') || ''

    const where: Record<string, unknown> = {}
    if (grade) where.grade = grade
    if (keyword) {
      where.OR = [{ title: { contains: keyword } }]
    }
    if (!admin) {
      where.AND = [{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] }]
    }

    const [homework, total] = await Promise.all([
      db.homework.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.homework.count({ where }),
    ])

    /* (2026-و26) استهداف الطلاب (نفس نمط الفيديوهات): الواجب الموجه
       لطلاب محددين مش بيوصل غير للي اسمه في القايمة — فلترة على السيرفر */
    let visibleHw = homework as unknown as any[]
    if (!admin) {
      visibleHw = visibleHw.filter(function (h) {
        var t = parseTargetIds(h && (h as any).targetStudentIds)
        return t.length === 0 || (!!studentId && t.indexOf(studentId) !== -1)
      })
    }

    // بادج «مجدول» للأدمن على العناصر المستقبلية
    const outHomework = admin
      ? visibleHw.map(function (h: any) { return isScheduledFuture(h) ? { ...h, scheduled: true } : h })
      : visibleHw

    return NextResponse.json({ homework: outHomework, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (error: any) {
    console.error('Homework fetch error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureExamSettingsColumns(function (sql: string) { return db.$executeRawUnsafe(sql) })

    const body = await request.json()
    const { title, content, grade, filePath, fileType, answerKeyPath, answerKeyType, thumbnail, questions, targetStudentIds } = body

    if (!title || !grade) {
      return NextResponse.json({ error: 'Title and grade are required' }, { status: 400 })
    }

    // (2026-و25 نقل 25-b1) موعد ظهور الواجب (ISO|null)
    var scheduledAt: Date | null = null
    if (body.scheduledAt) {
      try {
        var sd = new Date(String(body.scheduledAt))
        if (!isNaN(sd.getTime())) scheduledAt = sd
      } catch (e) { scheduledAt = null }
    }

    /* (2026-و26) استهداف الطلاب: array ids → JSON string (فاضي = الكل) */
    var targetIds = '[]'
    if (targetStudentIds !== undefined && targetStudentIds !== null) {
      var tArr: unknown[] = []
      if (Array.isArray(targetStudentIds)) tArr = targetStudentIds
      else { try { var tp = JSON.parse(String(targetStudentIds)); if (Array.isArray(tp)) tArr = tp } catch (e) {} }
      var tClean = tArr.map(function (x) { return String(x == null ? '' : x).trim() }).filter(Boolean)
      tClean = tClean.filter(function (x: string, i: number) { return tClean.indexOf(x) === i })
      targetIds = JSON.stringify(tClean)
    }

    const homework = await db.homework.create({
      data: { title, content: content || '', grade, filePath: filePath || '', fileType: fileType || '', thumbnail: thumbnail || '', answerKeyPath: answerKeyPath || '', answerKeyType: answerKeyType || '', questions: questions || '', scheduledAt, targetStudentIds: targetIds },
    })

    return NextResponse.json({ message: 'Homework added', homework }, { status: 201 })
  } catch (error: any) {
    console.error('Homework create error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}
