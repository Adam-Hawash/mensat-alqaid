
import { NextRequest, NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'
import { isAdmin } from '@/lib/video-guard'
import { ensureExamSettingsColumns } from '@/lib/ensure-schema'

// GET /api/exams/[id] - جلب امتحان بالمعرف
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const exam = await db.exam.findUnique({ where: { id } })

    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 })
    }

    return NextResponse.json({ exam })
  } catch (error) {
    console.error('فشل جلب الامتحان:', error)
    return NextResponse.json({ error: 'حدث خطأ في السيرفر' }, { status: 500 })
  }
}

// PUT /api/exams/[id] - تحديث الامتحان
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, content, grade, questions, models, modelMode, fixedModel } = body

    const existing = await db.exam.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 })
    }

    const exam = await db.exam.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(grade && { grade }),
        ...(questions !== undefined && { questions: typeof questions === 'string' ? questions : JSON.stringify(questions) }),
        // نماذج الامتحان العشوائية (اختياري)
        ...(models !== undefined && { models: typeof models === 'string' ? models : JSON.stringify(models) }),
        // طريقة التوزيع (2026-و): عشوائي أو نموذج واحد ثابت للكل
        ...(modelMode !== undefined && { modelMode: modelMode === 'fixed' ? 'fixed' : 'random' }),
        ...(fixedModel !== undefined && { fixedModel: modelMode === 'fixed' ? String(fixedModel || '') : '' }),
      },
    })

    return NextResponse.json({ message: 'تم تحديث الامتحان بنجاح', exam })
  } catch (error) {
    console.error('تحديث الامتحانفشل:', error)
    return NextResponse.json({ error: 'حدث خطأ في السيرفر' }, { status: 500 })
  }
}

// PATCH /api/exams/[id] - (2026-و25 نقل 25-b1) تعديل جزئي لإعدادات الامتحان:
// {adminId, showResult?, timeLimitMin?, scheduledAt?, targetStudentIds?} —
// scheduledAt: null = إلغاء الجدولة، نص ISO = جدولة، بايظ = 400 — بنفس نمط auth الأدمن
// (isAdmin زي /api/videos و /api/files بالظبط)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const adminId = body.adminId || ''

    if (!(await isAdmin(adminId))) {
      return NextResponse.json({ error: 'غير مصرح — أدمن فقط' }, { status: 401 })
    }

    await ensureExamSettingsColumns(function (sql: string) { return db.$executeRawUnsafe(sql) })

    const existing = await db.exam.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.showResult !== undefined) {
      data.showResult = body.showResult === true || body.showResult === 'true' || body.showResult === 1
    }
    if (body.timeLimitMin !== undefined) {
      var tlm = parseInt(String(body.timeLimitMin ?? ''), 10)
      if (isNaN(tlm) || tlm < 0) tlm = 0
      data.timeLimitMin = tlm
    }
    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt === null || body.scheduledAt === '') {
        data.scheduledAt = null // إلغاء الجدولة
      } else {
        try {
          var sd = new Date(String(body.scheduledAt))
          if (isNaN(sd.getTime())) {
            return NextResponse.json({ error: 'موعد الظهور غير صالح' }, { status: 400 })
          }
          data.scheduledAt = sd
        } catch (e) {
          return NextResponse.json({ error: 'موعد الظهور غير صالح' }, { status: 400 })
        }
      }
    }
    /* (2026-و26) استهداف الطلاب: array ids → JSON string (فاضي = الكل يشوفه) */
    if (body.targetStudentIds !== undefined) {
      var arr: unknown[] = []
      if (Array.isArray(body.targetStudentIds)) arr = body.targetStudentIds
      else { try { var pp = JSON.parse(String(body.targetStudentIds)); if (Array.isArray(pp)) arr = pp } catch (e) {} }
      var cleanIds = arr.map(function (x) { return String(x == null ? '' : x).trim() }).filter(Boolean)
      cleanIds = cleanIds.filter(function (x: string, i: number) { return cleanIds.indexOf(x) === i })
      data.targetStudentIds = JSON.stringify(cleanIds)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'مفيش حقول للتعديل' }, { status: 400 })
    }

    const exam = await safeWrite(function () {
      return db.exam.update({ where: { id }, data })
    })

    return NextResponse.json({ message: 'تم تحديث إعدادات الامتحان', exam })
  } catch (error: any) {
    console.error('PATCH exam error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}

// DELETE /api/exams/[id] - حذف الامتحان
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.exam.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 })
    }

    // المستر (2026-و18/18-d): أي امتحان أمسحه — نقاطه وإجاباته تختفي في نفس اللحظة
    // من صفحة الأدمن. بنمسح النتايج + الامتحان جوه ترانزاكشن واحدة
    // (يا الاتنين يتمّوا يا مفيش حاجة بتتحذف) — مفيش صفوف يتيمة تفضل ورا.
    // الفورين كي مش مفروض على داتابيز الإنتاج (اتعملت بـ raw SQL) فبنمسح يدوي جوه الترانزاكشن،
    // وsafeWrite بيحمينا من database is locked زي باقي كتابات المنصة.
    try {
      await safeWrite(async function () {
        return db.$transaction([
          db.$executeRawUnsafe('DELETE FROM ExamResult WHERE examId = ?', id),
          db.exam.delete({ where: { id } }),
        ])
      })
    } catch (txError) {
      // محاولة احتياطية بنفس الترانزاكشن عبر Prisma لو الـ raw SQL فشل
      console.error('حذف الامتحان بترانزاكشن raw فشل — محاولة احتياطية:', txError)
      await safeWrite(async function () {
        return db.$transaction([
          db.examResult.deleteMany({ where: { examId: id } }),
          db.exam.delete({ where: { id } }),
        ])
      })
    }

    return NextResponse.json({ message: 'تم حذف الامتحان بنجاح' })
  } catch (error) {
    console.error('حذف الامتحانفشل:', error)
    return NextResponse.json({ error: 'حدث خطأ في السيرفر' }, { status: 500 })
  }
}
