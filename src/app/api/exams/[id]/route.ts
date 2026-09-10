
import { NextRequest, NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'

// GET /api/exams/[id] - 获取单个考试
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const exam = await db.exam.findUnique({ where: { id } })

    if (!exam) {
      return NextResponse.json({ error: '考试不存在' }, { status: 404 })
    }

    return NextResponse.json({ exam })
  } catch (error) {
    console.error('获取考试详情失败:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}

// PUT /api/exams/[id] - 更新考试
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
      return NextResponse.json({ error: '考试不存在' }, { status: 404 })
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

    return NextResponse.json({ message: '考试更新成功', exam })
  } catch (error) {
    console.error('更新考试失败:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}

// DELETE /api/exams/[id] - 删除考试
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.exam.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '考试不存在' }, { status: 404 })
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

    return NextResponse.json({ message: '考试删除成功' })
  } catch (error) {
    console.error('删除考试失败:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
