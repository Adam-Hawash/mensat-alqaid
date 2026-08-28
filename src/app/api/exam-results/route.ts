import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/exam-results?examId=xxx OR ?studentId=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const examId = searchParams.get('examId')
  const studentId = searchParams.get('studentId')

  // === Student view: return this student's results ===
  if (studentId) {
    try {
      const results = await db.examResult.findMany({
        where: { studentId },
        orderBy: { submittedAt: 'desc' },
      })
      // Enrich with exam title and passScore
      const examIds = [...new Set(results.map((r: any) => r.examId))]
      const exams = examIds.length > 0
        ? await db.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true, passScore: true } })
        : []
      const examMap = Object.fromEntries(exams.map((e: any) => [e.id, e]))
      const enriched = results.map((r: any) => ({
        id: r.id,
        examId: r.examId,
        studentId: r.studentId,
        score: r.score,
        maxScore: r.maxScore,
        submittedAt: r.submittedAt,
        examTitle: examMap[r.examId]?.title || '',
        passScore: examMap[r.examId]?.passScore || 50,
        passed: r.score >= (examMap[r.examId]?.passScore || 50),
      }))
      return NextResponse.json({ results: enriched })
    } catch (error) {
      console.error('Exam results student error:', error)
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })
    }
  }

  // === Admin view: return all results for an exam ===
  if (!examId) {
    return NextResponse.json({ error: 'examId or studentId required' }, { status: 400 })
  }

  try {
    const results = await db.examResult.findMany({
      where: { examId },
      include: { student: { select: { name: true, phone: true, grade: true, status: true } } },
      orderBy: { submittedAt: 'desc' },
    })

    const exam = await db.exam.findUnique({ where: { id: examId } })
    const submittedStudentIds = new Set(results.map((r: any) => r.studentId))
    const notTaken = exam ? await db.student.findMany({
      where: { grade: exam.grade, status: 'approved', id: { not: { in: Array.from(submittedStudentIds) } } },
      select: { id: true, name: true, phone: true },
    }) : []

    const questionMisses: Record<number, { question: string; total: number; wrong: number }> = {}
    results.forEach((r: any) => {
      if (r.details) {
        try {
          const dets = JSON.parse(r.details)
          dets.forEach((d: any, idx: number) => {
            if (!questionMisses[idx]) {
              questionMisses[idx] = { question: d.question, total: 0, wrong: 0 }
            }
            questionMisses[idx].total++
            if (!d.correct) questionMisses[idx].wrong++
          })
        } catch {}
      }
    })
    const mostMissed = Object.values(questionMisses)
      .filter((q: any) => q.wrong > 0)
      .sort((a: any, b: any) => b.wrong - a.wrong)

    return NextResponse.json({ results, notTaken, mostMissed })
  } catch (error) {
    console.error('Exam results error:', error)
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })
  }
}
