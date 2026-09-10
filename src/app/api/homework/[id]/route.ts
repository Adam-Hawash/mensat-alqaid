
import { NextRequest, NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'

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
