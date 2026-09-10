// @ts-nocheck
import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { gradeImageAnswer, gradeTextAnswer, extractImageMediaIds } from '@/lib/ai-image-grader'
import { regradeExamResult, gradesLookPending, questionsHaveWriting } from '@/lib/regrade-core'
import { gradeFallbackDecisive } from '@/lib/smart-grader'

// GET /api/exam-results?examId=xxx OR ?studentId=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const examId = searchParams.get('examId')
  const studentId = searchParams.get('studentId')

  // === Student view: return this student's results (with stored writingGrades) ===
  if (studentId) {
    try {
      // writingGrades column may not exist on old databases — ensure it first
      try { await db.$executeRawUnsafe('ALTER TABLE ExamResult ADD COLUMN writingGrades TEXT DEFAULT ""') } catch (e) {}
      var rows: any[] = await db.$queryRawUnsafe(
        'SELECT id, examId, studentId, score, maxScore, submittedAt, writingGrades FROM ExamResult WHERE studentId = ? ORDER BY submittedAt DESC',
        studentId
      ) || []
      // Enrich with exam title and passScore
      var examIds = [...new Set(rows.map(function (r: any) { return r.examId }))]
      var exams = examIds.length > 0
        ? await db.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true, passScore: true } })
        : []
      var examMap: any = {}
      exams.forEach(function (e: any) { examMap[e.id] = e })
      var withGrades = rows.map(function (r: any) {
        var wg: any[] = []
        try { wg = r.writingGrades ? JSON.parse(r.writingGrades) : [] } catch (e) { wg = [] }
        return {
          id: r.id,
          examId: r.examId,
          studentId: r.studentId,
          score: r.score,
          maxScore: r.maxScore,
          submittedAt: r.submittedAt,
          examTitle: examMap[r.examId]?.title || '',
          passScore: examMap[r.examId]?.passScore || 50,
          passed: r.score >= (examMap[r.examId]?.passScore || 50),
          writingGrades: wg,
        }
      })

      // self-heal: نتايج قديمة ناقصة التصحيح → إعادة تصحيح تلقائي بالذكاء الاصطناعي
      // في الخلفية بعد الرد — الطالب يحدّث الصفحة يلاقي درجته اتحطت
      try {
        var pendingIds: string[] = []
        var qMap: Record<string, string> = {}
        try {
          var qRows = await db.$queryRawUnsafe('SELECT er.id AS rid, e.questions AS qs FROM ExamResult er INNER JOIN Exam e ON e.id = er.examId WHERE er.studentId = ?', studentId)
          ;(qRows || []).forEach(function(qr: any) { qMap[qr.rid] = qr.qs })
        } catch (e) {}
        for (var pi = 0; pi < (rows || []).length; pi++) {
          var rid = rows[pi].id
          if (gradesLookPending(rows[pi].writingGrades) && questionsHaveWriting(qMap[rid])) pendingIds.push(rid)
        }
        if (pendingIds.length > 0) {
          var healIds = pendingIds.slice(0, 10)
          after(async function() {
            for (var hi = 0; hi < healIds.length; hi++) {
              try { await regradeExamResult(healIds[hi]) } catch (e) {}
            }
          })
        }
      } catch (e) {}

      return NextResponse.json({ results: withGrades })
    } catch (error) {
      console.error('Exam results student error:', error)
      // Fallback: same shape without the writingGrades column
      try {
        const results = await db.examResult.findMany({
          where: { studentId },
          orderBy: { submittedAt: 'desc' },
        })
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
          writingGrades: [],
        }))
        return NextResponse.json({ results: enriched })
      } catch (e2) {
        return NextResponse.json({ results: [] })
      }
    }
  }

  // === Admin view: return all results for an exam ===
  if (!examId) {
    return NextResponse.json({ error: 'examId or studentId required' }, { status: 400 })
  }

  try {
    // writingGrades column may not exist on old databases — ensure it first
    try { await db.$executeRawUnsafe('ALTER TABLE ExamResult ADD COLUMN writingGrades TEXT DEFAULT ""') } catch (e) {}
    // Read with raw SQL to get answers + stored writingGrades (fast path) + legacy writingResults
    var rawResults: any[] = []
    try {
      rawResults = await db.$queryRawUnsafe(
        'SELECT id, examId, studentId, score, maxScore, answers, writingResults, writingGrades, submittedAt FROM ExamResult WHERE examId = ? ORDER BY submittedAt DESC',
        examId
      ) || []
    } catch (e) {
      try {
        rawResults = await db.examResult.findMany({
          where: { examId },
          orderBy: { submittedAt: 'desc' },
        })
        rawResults = rawResults.map(function (r: any) { return { ...r, writingGrades: '', writingResults: '' } })
      } catch (e2) { rawResults = [] }
    }

    // Map student info
    var studentMap: any = {}
    var studentIds = rawResults.map((r: any) => r.studentId).filter(Boolean)
    var studentLookupOk = studentIds.length === 0
    if (studentIds.length > 0) {
      try {
        var ph = studentIds.map(function() { return '?' }).join(',')
        var studs = await db.$queryRawUnsafe('SELECT id, name, phone, grade, status FROM Student WHERE id IN (' + ph + ')', ...studentIds) || []
        studs.forEach(function(s: any) { studentMap[s.id] = s })
        studentLookupOk = true
      } catch (e) {}
    }

    // (2026-و18/18-d) فلترة الصفوف اليتيمة: نتيجة طالب حسابه اتحذف متتعرضش
    // في الأدمن خالص — والفلترة بس لو جلب الطلاب نجح عشان خطأ مؤقت مايفضيش كل القايمة
    if (studentLookupOk && studentIds.length > 0) {
      rawResults = rawResults.filter(function(r: any) { return !!studentMap[r.studentId] })
    }

    // Parse exam questions — writing questions keyed by ORIGINAL index (for live fallback)
    var examRow: any = null
    try { examRow = await db.exam.findUnique({ where: { id: examId }, select: { id: true, grade: true, questions: true, passScore: true } }) } catch (e) {
      // fallback: raw SQL لو Prisma وقع مؤقتًا
      try {
        var examRows0: any[] = (await db.$queryRawUnsafe('SELECT id, grade, questions, passScore FROM Exam WHERE id = ? LIMIT 1', examId)) as any[]
        examRow = examRows0 && examRows0.length > 0 ? examRows0[0] : null
      } catch (e2) {}
    }

    // (2026-و18/18-d) وجود الامتحان شرط: لو الامتحان نفسه اتحذف — نتايجه القديمة
    // (صفوف يتيمة) متتعرضش خالص، نفس حماية باقي صفحات نتايج الأدمن
    if (!examRow) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    }
    var examWritingQs: any[] = []
    try {
      var examQsRaw: any[] = []
      if (examRow && examRow.questions) {
        var parsedExamQs = typeof examRow.questions === 'string' ? JSON.parse(examRow.questions) : examRow.questions
        if (Array.isArray(parsedExamQs)) examQsRaw = parsedExamQs
      }
      examQsRaw.forEach(function(q: any, idx: number) {
        var isWriting = q.type === 'writing' || q.type === 'essay'
        if (!isWriting && Array.isArray(q.options)) {
          var allNA = q.options.length > 0 && q.options.every(function(o: any) { return !o || o === 'N/A' || o === 'لا يوجد' || String(o).trim() === '' })
          if (allNA) isWriting = true
        }
        if (!isWriting && (!q.options || q.options.length === 0)) isWriting = true
        if (isWriting) {
          examWritingQs.push({
            origIdx: idx,
            question: q.question || q.q || '',
            modelAnswer: q.modelAnswer || q.answer || '',
            acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
            points: (typeof q.points === 'number' && q.points > 0) ? q.points : 5,
          })
        }
      })
    } catch (e) {}

    function normQ(s: any): string {
      return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
    }
    function lookupAns(ans: any, idx: number): any {
      try {
        if (Array.isArray(ans)) return ans[idx]
        if (ans !== null && typeof ans === 'object') {
          return ans[idx] !== undefined ? ans[idx] : ans[String(idx)]
        }
      } catch (e) {}
      return undefined
    }

    const results = await Promise.all(rawResults.map(async function(r: any) {
      var st = studentMap[r.studentId] || {}

      // 1) Stored AI writing grades (saved at submit time) — fast path, no live AI
      var storedByOrig: Record<number, any> = {}
      try {
        var storedArr: any[] = r.writingGrades ? (typeof r.writingGrades === 'string' ? JSON.parse(r.writingGrades) : r.writingGrades) : []
        if (Array.isArray(storedArr)) {
          storedArr.forEach(function(sg: any) { if (sg && typeof sg.origIdx === 'number') storedByOrig[sg.origIdx] = sg })
        }
      } catch (e) {}

      // 2) Legacy writingResults (pre-submit-time grading) — matched by question text
      var legacyByQ: Record<string, any> = {}
      try {
        var legacyArr: any[] = r.writingResults ? (typeof r.writingResults === 'string' ? JSON.parse(r.writingResults) : r.writingResults) : []
        if (Array.isArray(legacyArr)) {
          legacyArr.forEach(function(lw: any) {
            if (lw && lw.question && !legacyByQ[normQ(lw.question)]) legacyByQ[normQ(lw.question)] = lw
          })
        }
      } catch (e) {}

      // 3) Student answers (needed for the live-AI fallback)
      var storedAnswers: any = {}
      try {
        if (r.answers) storedAnswers = typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers
      } catch (e) {}

      var writingAnswers: any[] = []
      for (var wi = 0; wi < examWritingQs.length; wi++) {
        var wq = examWritingQs[wi]
        // FAST PATH: grades stored at submit time → use them directly (no live AI)
        var stored = storedByOrig[wq.origIdx]
        if (stored) {
          var storedAwarded = Math.min(Math.max(Math.round(Number(stored.awardedPoints) || 0), 0), wq.points)
          var storedIsCorrect = stored.isCorrect === true || (storedAwarded >= Math.ceil(wq.points * 0.5) && storedAwarded > 0)
          var storedAnsText = String(stored.answer || '')
          writingAnswers.push({
            question: wq.question,
            answer: storedAnsText,
            points: wq.points,
            maxPoints: stored.maxPoints || wq.points,
            modelAnswer: stored.modelAnswer || wq.modelAnswer,
            acceptedAnswers: wq.acceptedAnswers,
            isCorrect: storedIsCorrect,
            awardedPoints: storedAwarded,
            gradingStatus: 'graded',
            needsGrading: false,
            feedback: stored.feedback || (storedIsCorrect ? 'صح' : 'غلط'),
            aiExtractedAnswer: stored.aiExtractedAnswer || storedAnsText,
            aiIsCorrect: storedIsCorrect,
            aiFeedback: stored.feedback || (storedIsCorrect ? 'صح' : 'غلط'),
            aiAwardedPoints: storedAwarded,
            imageGraded: /\[📷/.test(storedAnsText),
            textGraded: !/\[📷/.test(storedAnsText),
            isGraded: true,
          })
          continue
        }
        // LEGACY: verdicts stored by the old background grader — matched by question text
        var legacy = legacyByQ[normQ(wq.question)]
        if (legacy) {
          writingAnswers.push(Object.assign({ points: wq.points, maxPoints: legacy.maxPoints || wq.points }, legacy, { question: wq.question }))
          continue
        }
        // LIVE AI fallback for results saved before stored grading existed
        var lookedUp = lookupAns(storedAnswers, wq.origIdx)
        var studentText = lookedUp !== undefined && lookedUp !== null ? String(lookedUp) : ''
        if (!studentText || studentText === '[📷 صورة مرفقة]' || studentText.trim() === '') {
          writingAnswers.push({
            question: wq.question, answer: studentText, points: wq.points, maxPoints: wq.points,
            modelAnswer: wq.modelAnswer, acceptedAnswers: wq.acceptedAnswers,
            gradingStatus: 'graded', needsGrading: false, isCorrect: false, awardedPoints: 0,
            feedback: 'لم يجب الطالب', aiExtractedAnswer: '(فارغ)', aiIsCorrect: false,
            aiFeedback: 'لم يجب الطالب', aiAwardedPoints: 0, isGraded: true,
          })
          continue
        }
        var mediaIds = extractImageMediaIds(studentText)
        var liveAwarded = 0
        var liveIsCorrect = false
        var liveFeedback = ''
        var liveExtracted = studentText
        if (mediaIds.length > 0) {
          try {
            var liveImg = await gradeImageAnswer({
              mediaId: mediaIds[0], question: wq.question, modelAnswer: wq.modelAnswer,
              acceptedAnswers: wq.acceptedAnswers, maxPoints: wq.points,
            })
            if (liveImg) {
              liveAwarded = Math.min(Math.max(Math.round(Number(liveImg.awardedPoints) || (liveImg.isCorrect ? wq.points : 0)), 0), wq.points)
              liveIsCorrect = liveImg.isCorrect === true || liveAwarded >= Math.ceil(wq.points * 0.5) && liveAwarded > 0
              liveFeedback = liveImg.feedback || ''
              liveExtracted = liveImg.extractedAnswer || studentText
            }
          } catch (le) { console.error('[Exam Results] AI grade image error:', le) }
        } else {
          try {
            var liveTxt = await gradeTextAnswer({
              question: wq.question, studentAnswer: studentText, modelAnswer: wq.modelAnswer,
              acceptedAnswers: wq.acceptedAnswers, maxPoints: wq.points,
            })
            if (liveTxt) {
              liveAwarded = Math.min(Math.max(Math.round(Number(liveTxt.awardedPoints) || (liveTxt.isCorrect ? wq.points : 0)), 0), wq.points)
              liveIsCorrect = liveTxt.isCorrect === true || liveAwarded >= Math.ceil(wq.points * 0.5) && liveAwarded > 0
              liveFeedback = liveTxt.feedback || ''
            }
          } catch (le2) { console.error('[Exam Results] AI text grading error:', le2) }
        }
        if (liveFeedback === '' && liveAwarded === 0 && !liveIsCorrect) {
          // المستر: مفيش حاجة اسمها تصحيح يدوي — لما الـ AI يعجز السؤال بياخد حكم محلي حاسم
          // (نص → gradeFallbackDecisive | صورة → درجة محاولة عادلة)
          if (mediaIds.length > 0) {
            var hasRealWork = studentText.replace(/\[📷[^\]]*\]/g, '').trim().length > 0
            liveAwarded = hasRealWork ? Math.ceil(wq.points / 2) : 0
            liveIsCorrect = hasRealWork
            liveFeedback = hasRealWork ? 'صورة الحل اترفعت — المستر هيراجعها ويعادلها' : 'لم يتم الإجابة'
            liveExtracted = ''
          } else {
            try {
              var fbGrade = gradeFallbackDecisive({ question: wq.question, answer: studentText, modelAnswer: wq.modelAnswer, acceptedAnswers: wq.acceptedAnswers, points: wq.points })
              liveAwarded = Math.min(Math.max(Math.round(Number(fbGrade.awardedPoints) || 0), 0), wq.points)
              liveIsCorrect = fbGrade.isCorrect === true
              liveFeedback = fbGrade.feedback || 'تم التصحيح آلياً'
              liveExtracted = studentText || '(فارغ)'
            } catch (e) {
              liveFeedback = 'لم يتم الإجابة'
              liveExtracted = '(فارغ)'
            }
          }
        }
        writingAnswers.push({
          question: wq.question, answer: studentText, points: wq.points, maxPoints: wq.points,
          modelAnswer: wq.modelAnswer, acceptedAnswers: wq.acceptedAnswers,
          gradingStatus: 'graded', needsGrading: false,
          isCorrect: liveIsCorrect, awardedPoints: liveAwarded,
          feedback: liveFeedback, aiExtractedAnswer: liveExtracted,
          aiIsCorrect: liveIsCorrect, aiFeedback: liveFeedback, aiAwardedPoints: liveAwarded,
          imageGraded: mediaIds.length > 0, textGraded: mediaIds.length === 0, isGraded: true,
        })
      }

      return {
        id: r.id,
        examId: r.examId,
        studentId: r.studentId,
        score: r.score,
        maxScore: r.maxScore,
        submittedAt: r.submittedAt,
        answers: storedAnswers,
        student: { name: st.name || 'طالب محذوف', phone: st.phone || '', grade: st.grade || '', status: st.status || '' },
        writingAnswers: writingAnswers,
        hasWritingAnswers: writingAnswers.length > 0,
        writingPending: writingAnswers.some(function(wa: any) { return wa.gradingStatus === 'pending' }),
      }
    }))

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

    // self-heal: النتايج اللي مالهاش درجات مخزنة بتتصحح في الخلفية بعد الرد
    // (التسليمات القديمة قبل ما التصحيح الفوري يبقى موجود)
    try {
      var examInfo: any = null
      try { examInfo = exam } catch (e) {}
      var healIds2: string[] = []
      var examHasWritingQs = questionsHaveWriting(examInfo && examInfo.questions)
      for (var hi2 = 0; hi2 < rawResults.length; hi2++) {
        if (examHasWritingQs && gradesLookPending(rawResults[hi2].writingGrades)) healIds2.push(rawResults[hi2].id)
      }
      if (healIds2.length > 0) {
        var healBatch = healIds2.slice(0, 10)
        after(async function() {
          for (var hi3 = 0; hi3 < healBatch.length; hi3++) {
            try { await regradeExamResult(healBatch[hi3]) } catch (e) {}
          }
        })
      }
    } catch (e) {}

    return NextResponse.json({ results, notTaken, mostMissed })
  } catch (error) {
    console.error('Exam results error:', error)
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })
  }
}
