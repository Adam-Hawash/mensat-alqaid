import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/homework/results?studentId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const results = await db.homeworkResult.findMany({
      where: { studentId },
      orderBy: { submittedAt: 'desc' },
    })

    // Enrich with homework title
    const hwIds = [...new Set(results.map((r: any) => r.homeworkId))]
    const hws = hwIds.length > 0
      ? await db.homework.findMany({ where: { id: { in: hwIds } }, select: { id: true, title: true } })
      : []
    const hwMap = Object.fromEntries(hws.map((h: any) => [h.id, h]))

    const enriched = results.map((r: any) => ({
      id: r.id,
      homeworkId: r.homeworkId,
      studentId: r.studentId,
      score: r.score,
      maxScore: r.maxScore,
      submittedAt: r.submittedAt,
      homeworkTitle: hwMap[r.homeworkId]?.title || '',
      passed: r.score >= Math.ceil(r.maxScore * 0.5),
    }))

    return NextResponse.json({ results: enriched })
  } catch (error) {
    console.error('Homework results error:', error)
    return NextResponse.json({ error: 'Failed to fetch homework results' }, { status: 500 })
  }
}
