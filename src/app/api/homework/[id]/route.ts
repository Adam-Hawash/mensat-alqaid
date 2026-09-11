
import { NextRequest, NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'
import { isAdmin } from '@/lib/video-guard'
import { ensureExamSettingsColumns } from '@/lib/ensure-schema'

// GET /api/homework/[id] - 获取单个作业
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const homework = await db.homework.findUnique({ where: { id } })

    if (!homework) {
      return NextResponse.json({ error: '作业不存在' }, { status: 404 })
    }

    return NextResponse.json({ homework })
  } catch (error) {
    console.error('获取作业详情失败:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}

// PUT /api/homework/[id] - 更新作业
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
      return NextResponse.json({ error: '作业不存在' }, { status: 404 })
    }

    const homework = await db.homework.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(grade && { grade }),
      },
    })

    return NextResponse.json({ message: '作业更新成功', homework })
  } catch (error) {
    console.error('更新作业失败:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}

// PATCH /api/homework/[id] - (2026-و25 نقل 25-b1) تعديل جزئي لإعدادات الواجب:
// {adminId, scheduledAt} — null = إلغاء الجدولة، نص ISO = جدولة — بنفس
// نمط auth الأدمن (isAdmin زي /api/videos بالظبط)
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

    if (body.scheduledAt === undefined) {
      return NextResponse.json({ error: 'مفيش حقول للتعديل' }, { status: 400 })
    }

    var scheduledAt: Date | null
    if (body.scheduledAt === null || body.scheduledAt === '') {
      scheduledAt = null // إلغاء الجدولة
    } else {
      try {
        var sd = new Date(String(body.scheduledAt))
        if (isNaN(sd.getTime())) {
          return NextResponse.json({ error: 'موعد الظهور غير صالح' }, { status: 400 })
        }
        scheduledAt = sd
      } catch (e) {
        return NextResponse.json({ error: 'موعد الظهور غير صالح' }, { status: 400 })
      }
    }

    const homework = await safeWrite(async function () {
      return db.homework.update({ where: { id }, data: { scheduledAt } })
    })

    return NextResponse.json({ message: 'تم تحديث موعد ظهور الواجب', homework })
  } catch (error: any) {
    console.error('PATCH homework error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}

// DELETE /api/homework/[id] - 删除作业
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.homework.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '作业不存在' }, { status: 404 })
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

    return NextResponse.json({ message: '作业删除成功' })
  } catch (error) {
    console.error('删除作业失败:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
