// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/homework-results?studentId=xxx - Student: own results (basic info)
// GET /api/homework-results?homeworkId=xxx - Admin: all results for a homework with per-student details
//
// NOTE: this view does NOT re-run the AI grader on every load — it reads the
// verdicts STORED at submit time (HomeworkResult.writingResults) — instant,
// stable, one source of truth (no more "تصحيح عشوائي" between visits).
// Answers are keyed by ORIGINAL question index (same as /api/homework/submit).
export async function GET(request: NextRequest) {
  try {
    var url = new URL(request.url)
    var studentId = url.searchParams.get('studentId')
    var homeworkId = url.searchParams.get('homeworkId')

    // Admin mode: results for a specific homework with full per-student answer review
    if (homeworkId) {
      // Ensure HomeworkResult table has answers + writingResults columns
      try {
        await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS HomeworkResult (id TEXT PRIMARY KEY, homeworkId TEXT NOT NULL, studentId TEXT NOT NULL, score REAL DEFAULT 0, maxScore REAL DEFAULT 100, answers TEXT DEFAULT "", submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP)')
      } catch (e) {}
      try { await db.$executeRawUnsafe('ALTER TABLE HomeworkResult ADD COLUMN answers TEXT DEFAULT ""') } catch (e) {}
      try { await db.$executeRawUnsafe('ALTER TABLE HomeworkResult ADD COLUMN submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP') } catch (e) {}
      try { await db.$executeRawUnsafe('ALTER TABLE HomeworkResult ADD COLUMN writingResults TEXT DEFAULT ""') } catch (e) {}

      // Get homework info first (title, questions)
      var hwInfo: any = null
      try {
        var hwRows = await db.$queryRawUnsafe('SELECT id, title, grade, questions FROM Homework WHERE id = ? LIMIT 1', homeworkId) || []
        hwInfo = hwRows.length > 0 ? hwRows[0] : null
      } catch (e) {
        try {
          hwInfo = await db.homework.findUnique({ where: { id: homeworkId } })
        } catch (e2) {}
      }

      if (!hwInfo) {
        return NextResponse.json({ error: 'Homework not found' }, { status: 404 })
      }

      // Get all results for this homework using RAW SQL with answers + stored writing verdicts
      var rawResults: any[] = []
      try {
        rawResults = await db.$queryRawUnsafe(
          'SELECT id, homeworkId, studentId, score, maxScore, submittedAt, answers, writingResults FROM HomeworkResult WHERE homeworkId = ? ORDER BY submittedAt DESC',
          homeworkId
        ) || []
      } catch (e) {
        console.error('Homework results fetch error:', e)
        try {
          rawResults = await db.$queryRawUnsafe(
            'SELECT id, homeworkId, studentId, score, maxScore, submittedAt, answers FROM HomeworkResult WHERE homeworkId = ? ORDER BY submittedAt DESC',
            homeworkId
          ) || []
        } catch (e3) {
          try {
            var prismaResults = await db.homeworkResult.findMany({
              where: { homeworkId },
              orderBy: { submittedAt: 'desc' },
            })
            rawResults = prismaResults.map((r: any) => ({ ...r, answers: '' }))
          } catch (e2) { rawResults = [] }
        }
      }

      // Get student info for each result
      var studentIds = rawResults.map((r: any) => r.studentId).filter(Boolean)
      var studentMap: any = {}
      var studentLookupOk = studentIds.length === 0
      if (studentIds.length > 0) {
        try {
          var placeholders = studentIds.map(function() { return '?' }).join(',')
          var students = await db.$queryRawUnsafe(
            'SELECT id, name, phone, grade FROM Student WHERE id IN (' + placeholders + ')',
            ...studentIds
          ) || []
          students.forEach(function(s: any) { studentMap[s.id] = s })
          studentLookupOk = true
        } catch (e) {
          console.error('Student lookup error:', e)
        }
      }

      // (2026-و18/18-d) فلترة الصفوف اليتيمة: نتيجة طالب حسابه اتحذف متتعرضش
      // في الأدمن خالص — والفلترة بس لو جلب الطلاب نجح عشان خطأ مؤقت مايفضيش كل القايمة
      if (studentLookupOk && studentIds.length > 0) {
        rawResults = rawResults.filter(function(r: any) { return !!studentMap[r.studentId] })
      }

      // Parse homework questions — keep ORIGINAL index
      var hwQuestions: any[] = []
      try {
        if (hwInfo.questions) {
          var raw = typeof hwInfo.questions === 'string' ? JSON.parse(hwInfo.questions) : hwInfo.questions
          if (Array.isArray(raw)) hwQuestions = raw
        }
      } catch (e) {}

      // Separate MCQ from writing — track original index
      var mcqQs: any[] = []
      var writingQs: any[] = []
      hwQuestions.forEach(function(q: any, oi: number) {
        var isWriting = q.type === 'writing' || q.type === 'essay'
        if (!isWriting && Array.isArray(q.options)) {
          var allNA = q.options.length > 0 && q.options.every(function(o: any) { return !o || o === 'N/A' || o === 'لا يوجد' || String(o).trim() === '' })
          if (allNA) isWriting = true
        }
        if (!isWriting && (!q.options || q.options.length === 0)) isWriting = true
        if (isWriting) writingQs.push({ q: q, origIdx: oi })
        else mcqQs.push({ q: q, origIdx: oi })
      })

      // Build per-student results with all questions review
      var results: any[] = []
      for (var ri = 0; ri < rawResults.length; ri++) {
        var r = rawResults[ri]
        var student = studentMap[r.studentId] || {}
        // Parse student answers
        var studentAns: any = {}
        try {
          if (r.answers) {
            studentAns = typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers
          }
        } catch (e) {}

        var allQuestions: any[] = []
        var wrongQuestions: any[] = []
        var writingAnswers: any[] = []

        // Stored AI verdicts (written by /api/homework/submit background grading)
        var storedWriting: any[] = []
        try {
          if (r.writingResults) {
            var parsedStored = typeof r.writingResults === 'string' ? JSON.parse(r.writingResults) : r.writingResults
            if (Array.isArray(parsedStored)) storedWriting = parsedStored
          }
        } catch (e) {}

        function lookupAns(ans: any, idx: number): any {
          try {
            if (Array.isArray(ans)) return ans[idx]
            if (ans !== null && typeof ans === 'object') {
              return ans[idx] !== undefined ? ans[idx] : ans[String(idx)]
            }
          } catch (e) {}
          return undefined
        }

        // MCQ all questions (keyed by original index)
        mcqQs.forEach(function(item) {
          var q = item.q
          var qText = q.question || q.q || ''
          var opts = Array.isArray(q.options) ? q.options : []
          var correctIdx = typeof q.correct === 'number' ? q.correct : 0
          if (correctIdx < 0 || correctIdx >= opts.length) correctIdx = 0

          var ans = lookupAns(studentAns, item.origIdx)

          var isCorrect = ans !== undefined && ans !== null && Number(ans) === correctIdx
          var studentAnswerText = (typeof ans === 'number' && opts[ans] && opts[ans] !== 'N/A')
            ? String.fromCharCode(65 + ans) + ') ' + opts[ans]
            : 'Not answered'
          var correctAnswerText = (opts[correctIdx] && opts[correctIdx] !== 'N/A')
            ? String.fromCharCode(65 + correctIdx) + ') ' + opts[correctIdx]
            : (q.modelAnswer || 'No correct answer stored')

          allQuestions.push({
            type: 'mcq',
            question: qText,
            studentAnswer: studentAnswerText,
            correctAnswer: correctAnswerText,
            isCorrect: isCorrect,
          })

          if (!isCorrect) {
            wrongQuestions.push({
              question: qText,
              studentAnswer: studentAnswerText,
              correctAnswer: correctAnswerText,
            })
          }
        })

        // Writing all questions — from STORED verdicts only
        writingQs.forEach(function(item, wi) {
          var q = item.q
          var qText = q.question || q.q || ''
          var studentText = lookupAns(studentAns, item.origIdx)
          studentText = typeof studentText === 'string' ? studentText : (studentText === undefined || studentText === null ? '' : String(studentText))

          var modelAnswer = q.modelAnswer || q.answer || ''
          var acceptedAnswers = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : []
          var pts = (typeof q.points === 'number' && q.points > 0) ? q.points : 5

          // Stored verdict for this writing question — **بالفهرس الأصلي** (2026-و22)
          // → نص السؤال → الموضع (للتسليمات القديمة بس). الـ fallback الموضعي الأول
          // كان بيربط حكم سؤال بسؤال تاني لما التطابق يفشل = «الورق في سؤال مش سؤاله»
          var stored = storedWriting.find(function(sw: any) { return sw && sw.origIdx === item.origIdx })
            || storedWriting.find(function(sw: any) { return sw && (sw.question || '') === qText })
            || storedWriting[wi]
            || null

          var isGradedNow = !!stored && stored.gradingStatus !== 'pending'
          var aiExtracted = stored ? (stored.aiExtractedAnswer || '') : ''
          var aiIsCorrect = stored ? (stored.aiIsCorrect === true || stored.isCorrect === true) : false
          var aiFeedback = stored ? (stored.aiFeedback || stored.feedback || '') : ''
          var awardedNow = stored ? (stored.awardedPoints || 0) : 0

          allQuestions.push({
            type: 'writing',
            question: qText,
            studentAnswer: studentText,
            correctAnswer: modelAnswer,
            isCorrect: isGradedNow ? aiIsCorrect : false,
            aiExtractedAnswer: aiExtracted,
            aiIsCorrect: aiIsCorrect,
            aiFeedback: aiFeedback,
            imageGraded: isGradedNow && !!aiExtracted,
          })

          writingAnswers.push({
            question: qText,
            answer: studentText,
            points: pts,
            modelAnswer: modelAnswer,
            acceptedAnswers: acceptedAnswers,
            needsGrading: !isGradedNow,
            gradingStatus: stored ? (stored.gradingStatus || (isGradedNow ? 'graded' : 'pending')) : 'legacy',
            aiExtractedAnswer: aiExtracted,
            aiIsCorrect: aiIsCorrect,
            aiFeedback: aiFeedback,
            imageGraded: isGradedNow && !!aiExtracted,
            isCorrect: isGradedNow ? aiIsCorrect : false,
            awardedPoints: isGradedNow ? awardedNow : 0,
          })
        })

        results.push({
          id: r.id,
          studentId: r.studentId,
          student: {
            name: student.name || 'طالب محذوف',
            phone: student.phone || '',
            grade: student.grade || hwInfo.grade || '',
          },
          score: r.score || 0,
          maxScore: r.maxScore || 100,
          submittedAt: r.submittedAt,
          passed: (r.score || 0) >= ((r.maxScore || 100) / 2),
          allQuestions: allQuestions,
          wrongQuestions: wrongQuestions,
          writingAnswers: writingAnswers,
          hasWritingAnswers: writingAnswers.length > 0,
        })
      }

      // Get students who haven't submitted the homework yet
      var notSubmitted: any[] = []
      try {
        var submittedIds = rawResults.map(function(r) { return r.studentId })
        if (submittedIds.length > 0) {
          var notPlaceholders = submittedIds.map(function() { return '?' }).join(',')
          notSubmitted = await db.$queryRawUnsafe(
            'SELECT id, name, phone FROM Student WHERE grade = ? AND status = ? AND id NOT IN (' + notPlaceholders + ')',
            hwInfo.grade, 'approved', ...submittedIds
          ) || []
        } else {
          notSubmitted = await db.$queryRawUnsafe(
            'SELECT id, name, phone FROM Student WHERE grade = ? AND status = ?',
            hwInfo.grade, 'approved'
          ) || []
        }
      } catch (e) {
        console.error('Not-submitted lookup error:', e)
        try {
          var submittedSet = new Set(submittedIds)
          notSubmitted = await db.student.findMany({
            where: { grade: hwInfo.grade, status: 'approved', id: { not: { in: Array.from(submittedSet) } } },
            select: { id: true, name: true, phone: true },
          })
        } catch (e2) { notSubmitted = [] }
      }

      var avgScore = results.length > 0
        ? (results.reduce(function(sum, r) { return sum + r.score }, 0) / results.length).toFixed(1)
        : '—'

      return NextResponse.json({
        results,
        notSubmitted,
        avgScore,
        hwInfo: {
          id: hwInfo.id,
          title: hwInfo.title,
          grade: hwInfo.grade,
          totalMcq: mcqQs.length,
          totalWriting: writingQs.length,
        },
      })
    }

    // Student mode: own results
    if (!studentId) return NextResponse.json({ results: [] })

    // Use raw SQL to avoid Prisma RETURN column mismatch
    var rows = await db.$queryRawUnsafe(
      'SELECT id, homeworkId, studentId, score, maxScore FROM HomeworkResult WHERE studentId = ?',
      studentId
    )

    return NextResponse.json({ results: rows || [] })
  } catch (error) {
    console.error('Homework results error:', error)
    return NextResponse.json({ results: [] })
  }
}
