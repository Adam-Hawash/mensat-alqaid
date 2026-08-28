import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/discussions/[id] - تعديل رسالة
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json({ error: 'المحتوى مطلوب' }, { status: 400 })
    }

    const existing = await db.discussion.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الرسالة مش موجودة' }, { status: 404 })
    }

    const discussion = await db.discussion.update({
      where: { id },
      data: { content },
    })

    return NextResponse.json({ message: 'الرسالة اتعدلت', discussion })
  } catch (error) {
    console.error('Discussion update error:', error)
    return NextResponse.json({ error: 'حصل مشكلة في التعديل' }, { status: 500 })
  }
}

// DELETE /api/discussions/[id] - حذف رسالة
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.discussion.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الرسالة مش موجودة' }, { status: 404 })
    }

    await db.discussion.delete({ where: { id } })
    return NextResponse.json({ message: 'الرسالة اتشالت' })
  } catch (error) {
    console.error('Discussion delete error:', error)
    return NextResponse.json({ error: 'حصل مشكلة في الحذف' }, { status: 500 })
  }
}
