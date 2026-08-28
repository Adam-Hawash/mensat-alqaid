import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/students/analytics?grade=X
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const grade = searchParams.get('grade')

    if (!grade) {
      return NextResponse.json({ error: 'Grade is required' }, { status: 400 })
    }

    const students = await db.student.findMany({
      where: { grade, status: 'approved' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true, grade: true, loginCount: true, lastLogin: true, createdAt: true },
    })

    if (students.length === 0) {
      return NextResponse.json({ students: [], gradeSummary: null })
    }

    const studentIds = students.map(s => s.id)

    const allVideoProgress = await db.videoProgress.findMany({ where: { studentId: { in: studentIds } } })
    const gradeVideos = await db.video.findMany({ where: { grade }, select: { id: true, title: true } })
    const totalGradeVideos = gradeVideos.length
    const gradeVideoIds = new Set(gradeVideos.map(v => v.id))

    const gradeExams = await db.exam.findMany({ where: { grade }, select: { id: true, title: true, passScore: true } })
    const totalGradeExams = gradeExams.length
    const gradeExamIds = new Set(gradeExams.map(e => e.id))

    const allExamResults = await db.examResult.findMany({ where: { studentId: { in: studentIds } } })

    // Homework stats (safe - table might not exist yet)
    let allHwResults: any[] = []
    try {
      allHwResults = await (db as any).homeworkResult?.findMany({ where: { studentId: { in: studentIds } } }) || []
    } catch { /* HomeworkResult table might not exist yet */ }

    const studentAnalytics = students.map(student => {
      const vp = allVideoProgress.filter(p => p.studentId === student.id)
      const gradeVp = vp.filter(p => gradeVideoIds.has(p.videoId))
      const watchedCount = gradeVp.length
      const avgWatchPercent = gradeVp.length > 0
        ? Math.min(100, Math.round(gradeVp.reduce((sum, p) => sum + Math.min(100, (p.totalSeconds > 0 ? (p.watchedSeconds / p.totalSeconds) * 100 : 0)), 0) / gradeVp.length))
        : 0

      const er = allExamResults.filter(r => r.studentId === student.id && gradeExamIds.has(r.examId))
      const examsTaken = er.length
      const avgScore = er.length > 0 ? Math.round(er.reduce((s, r: any) => s + r.score, 0) / er.length) : 0
      const examsPassed = er.filter((r: any) => {
        const exam = gradeExams.find(e => e.id === r.examId)
        return r.score >= Math.ceil(r.maxScore * ((exam?.passScore || 50) / 100))
      }).length

      const hwResults = allHwResults.filter((r: any) => r.studentId === student.id)
      const hwTaken = hwResults.length
      const avgHwScore = hwResults.length > 0 ? Math.round(hwResults.reduce((s: number, r: any) => s + r.score, 0) / hwResults.length) : 0

      const videoScore = totalGradeVideos > 0 ? (watchedCount / totalGradeVideos) * 40 : 0
      const examScore = totalGradeExams > 0 ? (examsTaken / totalGradeExams) * 30 : 0
      const qualityScore = examsTaken > 0 ? (avgScore / 100) * 20 : 0
      const loginScore = Math.min(student.loginCount, 10) * 1
      const activityScore = Math.round(videoScore + examScore + qualityScore + loginScore)

      return {
        ...student,
        watchedVideos: watchedCount,
        totalVideos: totalGradeVideos,
        avgWatchPercent,
        examsTaken,
        examsPassed,
        totalExams: totalGradeExams,
        avgExamScore: avgScore,
        hwTaken: hwTaken,
        avgHwScore: avgHwScore,
        activityScore: Math.min(activityScore, 100),
      }
    })

    studentAnalytics.sort((a: any, b: any) => b.activityScore - a.activityScore)

    const gradeSummary = {
      totalStudents: students.length,
      totalVideos: totalGradeVideos,
      totalExams: totalGradeExams,
      avgWatchPercent: studentAnalytics.length > 0 ? Math.round(studentAnalytics.reduce((s: number, a: any) => s + a.avgWatchPercent, 0) / studentAnalytics.length) : 0,
      avgExamScore: studentAnalytics.length > 0 ? Math.round(studentAnalytics.reduce((s: number, a: any) => s + a.avgExamScore, 0) / studentAnalytics.length) : 0,
      avgActivity: studentAnalytics.length > 0 ? Math.round(studentAnalytics.reduce((s: number, a: any) => s + a.activityScore, 0) / studentAnalytics.length) : 0,
    }

    return NextResponse.json({ students: studentAnalytics, gradeSummary })
  } catch (error) {
    console.error('Students analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
