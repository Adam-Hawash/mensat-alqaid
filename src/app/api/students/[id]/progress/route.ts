import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/students/[id]/progress - Student video progress + exam results + homework results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const student = await db.student.findUnique({ where: { id } })
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    // Video progress
    const videoProgress = await db.videoProgress.findMany({
      where: { studentId: id },
      orderBy: { lastWatchedAt: 'desc' },
    })

    const videoIds = [...new Set(videoProgress.map(vp => vp.videoId))]
    const videos = videoIds.length > 0
      ? await db.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, title: true, grade: true } })
      : []
    const videoMap = Object.fromEntries(videos.map(v => [v.id, v]))

    const videoProgressEnriched = videoProgress.map(vp => ({
      ...vp,
      percent: vp.totalSeconds > 0 ? Math.min(100, Math.round((vp.watchedSeconds / vp.totalSeconds) * 100)) : 0,
      videoTitle: videoMap[vp.videoId]?.title || 'فيديو محذوف',
      videoGrade: videoMap[vp.videoId]?.grade || '',
    }))

    // Exam results
    const examResults = await db.examResult.findMany({
      where: { studentId: id },
      orderBy: { submittedAt: 'desc' },
    })

    const examIds = [...new Set(examResults.map((er: any) => er.examId))]
    const exams = examIds.length > 0
      ? await db.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true, grade: true, passScore: true } })
      : []
    const examMap = Object.fromEntries(exams.map(e => [e.id, e]))

    const examResultsEnriched = examResults.map((er: any) => {
      var ps = examMap[er.examId]?.passScore || 50
      var passed = er.score >= Math.ceil(er.maxScore * ps / 100)
      return {
        ...er,
        examTitle: examMap[er.examId]?.title || 'امتحان محذوف',
        examGrade: examMap[er.examId]?.grade || '',
        passScore: ps,
        passed: passed,
        resultMessage: passed ? 'شاطر' : 'عايز مراجعة على الدروس',
      }
    })

    // Homework results
    const homeworkResults = await db.homeworkResult.findMany({
      where: { studentId: id },
      orderBy: { submittedAt: 'desc' },
    })

    const hwIds = [...new Set(homeworkResults.map((hr: any) => hr.homeworkId))]
    const homeworks = hwIds.length > 0
      ? await db.homework.findMany({ where: { id: { in: hwIds } }, select: { id: true, title: true, grade: true } })
      : []
    const hwMap = Object.fromEntries(homeworks.map(h => [h.id, h]))

    const homeworkResultsEnriched = homeworkResults.map((hr: any) => {
      var passed = hr.score >= Math.ceil(hr.maxScore * 0.5)
      return {
        ...hr,
        homeworkTitle: hwMap[hr.homeworkId]?.title || 'واجب محذوف',
        homeworkGrade: hwMap[hr.homeworkId]?.grade || '',
        passed: passed,
        resultMessage: passed ? 'شاطر' : 'عايز مراجعة على الدروس',
      }
    })

    // Summary
    const totalVideosWatched = videoProgress.length
    const completedVideos = videoProgress.filter(vp => vp.completed).length
    const avgWatchPercent = videoProgress.length > 0
      ? Math.min(100, Math.round(videoProgress.reduce((sum, vp) => sum + Math.min(100, (vp.totalSeconds > 0 ? (vp.watchedSeconds / vp.totalSeconds) * 100 : 0)), 0) / videoProgress.length))
      : 0
    const avgExamScore = examResults.length > 0
      ? Math.round(examResults.reduce((sum, er: any) => sum + er.score, 0) / examResults.length)
      : 0
    const examsPassed = examResults.filter((er: any) => er.score >= Math.ceil(er.maxScore * (examMap[er.examId]?.passScore || 50) / 100)).length
    const avgHwScore = homeworkResults.length > 0
      ? Math.round(homeworkResults.reduce((sum, hr: any) => sum + hr.score, 0) / homeworkResults.length)
      : 0

    return NextResponse.json({
      student: { id: student.id, name: student.name, grade: student.grade },
      videoProgress: videoProgressEnriched,
      examResults: examResultsEnriched,
      homeworkResults: homeworkResultsEnriched,
      summary: {
        totalVideosWatched,
        completedVideos,
        avgWatchPercent,
        totalExamsTaken: examResults.length,
        examsPassed,
        avgExamScore,
        totalHomeworkTaken: homeworkResults.length,
        avgHwScore,
      },
    })
  } catch (error) {
    console.error('Student progress error:', error)
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
  }
}
