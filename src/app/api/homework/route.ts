import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const grade = searchParams.get('grade')
    const keyword = searchParams.get('keyword')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const where: Record<string, unknown> = {}
    if (grade) where.grade = grade
    if (keyword) {
      where.OR = [{ title: { contains: keyword } }]
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

    return NextResponse.json({ homework, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (error: any) {
    console.error('Homework fetch error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, grade, filePath, fileType, answerKeyPath, answerKeyType, thumbnail, questions } = body

    if (!title || !grade) {
      return NextResponse.json({ error: 'Title and grade are required' }, { status: 400 })
    }

    const homework = await db.homework.create({
      data: { title, content: content || '', grade, filePath: filePath || '', fileType: fileType || '', thumbnail: thumbnail || '', answerKeyPath: answerKeyPath || '', answerKeyType: answerKeyType || '', questions: questions || '' },
    })

    return NextResponse.json({ message: 'Homework added', homework }, { status: 201 })
  } catch (error: any) {
    console.error('Homework create error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}
