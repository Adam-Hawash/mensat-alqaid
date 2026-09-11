
import { NextRequest, NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'
import { isAdmin } from '@/lib/video-guard'
import { ensureExamSettingsColumns } from '@/lib/ensure-schema'

// GET /api/homework/[id] - جلب واجب بالمعرف
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const homework = await db.homework.findUnique({ where: { id } })

    if (!homework) {
      return NextResponse.json({ error: 'الواجب غير موجود' }, { status: 404 })
    }

    return NextResponse.json({ homework })
  } catch (error) {
    console.error('فشل جلب الواجب:', error)
    return NextResponse.json({ error: 'حدث خطأ في السيرفر' }, { status: 500 })
  }
}

// PUT /api/homework/[id] - تحديث الواجب
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, content, grade } = body

    const existing = await db.homework.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الواجب غير موجود' }, { status: 404 })
    }

    const homework = await db.homework.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(grade && { grade }),
      },
    })

    return NextResponse.json({ message: 'تم تحديث الواجب بنجاح', homework })
  } catch (error) {
    console.error('تحديث الواجبفشل:', error)
    return NextResponse.json({ error: 'حدث خطأ في السيرفر' }, { status: 500 })
  }
}

// PATCH /api/homework/[id] - (2026-و25 نقل 25-b1) تعديل جزئي لإعدادات الواجب:
// {adminId, scheduledAt?, targetStudentIds?} — null = إلغاء الجدولة، نص ISO =
// جدولة — بنفس نمط auth الأدمن (isAdmin زي /api/videos بالظبط)
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

    const existing = await db.homework.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الواجب غير موجود' }, { status: 404 })
    }

    if (body.scheduledAt === undefined && body.targetStudentIds === undefined) {
      return NextResponse.json({ error: 'مفيش حقول للتعديل' }, { status: 400 })
    }

    var data: Record<string, unknown> = {}

    /* (2026-و26) استهداف الطلاب: array ids → JSON string (فاضي = الكل) */
    if (body.targetStudentIds !== undefined) {
      var tArr: unknown[] = []
      if (Array.isArray(body.targetStudentIds)) tArr = body.targetStudentIds
      else { try { var tp = JSON.parse(String(body.targetStudentIds)); if (Array.isArray(tp)) tArr = tp } catch (e) {} }
      var tClean = tArr.map(function (x) { return String(x == null ? '' : x).trim() }).filter(Boolean)
      tClean = tClean.filter(function (x: string, i: number) { return tClean.indexOf(x) === i })
      data.targetStudentIds = JSON.stringify(tClean)
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

    const homework = await safeWrite(async function () {
      return db.homework.update({ where: { id }, data })
    })

    return NextResponse.json({ message: 'تم تحديث إعدادات الواجب', homework })
  } catch (error: any) {
    console.error('PATCH homework error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}

// DELETE /api/homework/[id] - حذف الواجب
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.homework.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الواجب غير موجود' }, { status: 404 })
    }

    // المستر (2026-و18/18-d): حذف الواجب من المنصة = حذف كل حاجة تخصه في نفس الطلب
    // (تسليمات الطالب + درجاته + تصحيحات الـ AI) جوه ترانزاكشن واحدة
    // يا الاتنين يتمّوا يا مفيش حاجة بتتحذف — مفيش "واجب محذوف" يفضل ظاهر بدرجة
    // ولا صفوف يتيمة في صفحة الأدمن.
    // الفورين كي مش مفروض على داتابيز الإنتاج (اتعملت بـ raw SQL) فبنمسح يدوي جوه الترانزاكشن،
    // وsafeWrite بيحمينا من database is locked زي باقي كتابات المنصة.
    try {
      await safeWrite(async function () {
        return db.$transaction([
          db.$executeRawUnsafe('DELETE FROM HomeworkResult WHERE homeworkId = ?', id),
          db.homework.delete({ where: { id } }),
        ])
      })
    } catch (txError) {
      // محاولة احتياطية بنفس الترانزاكشن عبر Prisma لو الـ raw SQL فشل
      console.error('حذف الواجب بترانزاكشن raw فشل — محاولة احتياطية:', txError)
      await safeWrite(async function () {
        return db.$transaction([
          db.homeworkResult.deleteMany({ where: { homeworkId: id } }),
          db.homework.delete({ where: { id } }),
        ])
      })
    }

    return NextResponse.json({ message: 'تم حذف الواجب بنجاح' })
  } catch (error) {
    console.error('حذف الواجبفشل:', error)
    return NextResponse.json({ error: 'حدث خطأ في السيرفر' }, { status: 500 })
  }
}
