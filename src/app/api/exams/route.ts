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

    const [exams, total] = await Promise.all([
      db.exam.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.exam.count({ where }),
    ])

    return NextResponse.json({ exams, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (error: any) {
    console.error('Exams fetch error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, grade, filePath, fileType, questions, passScore, answerKeyPath, answerKeyType, thumbnail } = body

    if (!title || !grade) {
      return NextResponse.json({ error: 'Title and grade are required' }, { status: 400 })
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
        passScore: passScore ? parseFloat(passScore) : 50,
      },
    })

    return NextResponse.json({ message: 'Exam added', exam }, { status: 201 })
  } catch (error: any) {
    console.error('Exam create error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}
