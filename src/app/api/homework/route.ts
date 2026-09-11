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

    // بادج «مجدول» للأدمن على العناصر المستقبلية
    const outHomework = admin
      ? homework.map(function (h: any) { return isScheduledFuture(h) ? { ...h, scheduled: true } : h })
      : homework

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
    const { title, content, grade, filePath, fileType, answerKeyPath, answerKeyType, thumbnail, questions } = body

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

    const homework = await db.homework.create({
      data: { title, content: content || '', grade, filePath: filePath || '', fileType: fileType || '', thumbnail: thumbnail || '', answerKeyPath: answerKeyPath || '', answerKeyType: answerKeyType || '', questions: questions || '', scheduledAt },
    })

    return NextResponse.json({ message: 'Homework added', homework }, { status: 201 })
  } catch (error: any) {
    console.error('Homework create error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}
