// @ts-nocheck
// POST /api/exams/submit - Submit exam answers, save result INSTANTLY,
// then grade writing questions IN PARALLEL in the background.
// (منصة القائد — same engine as homework submit; MCQ graded locally by
//  ORIGINAL question index, writing questions graded by AI after response.)
import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { gradeImageAnswer, gradeTextAnswer, extractImageMediaIds } from '@/lib/ai-image-grader'

export const runtime = 'nodejs'
export const maxDuration = 120

async function ensureTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ExamResult (
        id TEXT PRIMARY KEY,
        examId TEXT NOT NULL,
        studentId TEXT NOT NULL,
        score REAL NOT NULL DEFAULT 0,
        maxScore REAL NOT NULL DEFAULT 100,
        answers TEXT DEFAULT '',
        submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    try { await db.$executeRawUnsafe('ALTER TABLE ExamResult ADD COLUMN answers TEXT DEFAULT ""') } catch(e) {}
    try { await db.$executeRawUnsafe('ALTER TABLE ExamResult ADD COLUMN submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP') } catch(e) {}
    // writingResults column — persisted AI verdicts (single source of truth)
    try { await db.$executeRawUnsafe('ALTER TABLE ExamResult ADD COLUMN writingResults TEXT DEFAULT ""') } catch(e) {}
  } catch (e) {
    console.error('Ensure ExamResult table error:', e)
  }
}

/* quick local text matching (fast path, no AI) */
function quickTextMatch(answerText: string, modelAnswer: string, acceptedAnswers: string[]): boolean {
  var cleanStudent = answerText.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!cleanStudent) return false
  if (acceptedAnswers && acceptedAnswers.length > 0) {
    for (var ai = 0; ai < acceptedAnswers.length; ai++) {
      var acc = (acceptedAnswers[ai] || '').trim().toLowerCase().replace(/\s+/g, ' ')
      if (acc && (cleanStudent === acc || cleanStudent.includes(acc) || acc.includes(cleanStudent))) return true
    }
  }
  if (modelAnswer) {
    var cleanModel = modelAnswer.toLowerCase().replace(/\s+/g, ' ').trim()
    if (cleanStudent === cleanModel || cleanStudent.includes(cleanModel) || cleanModel.includes(cleanStudent)) return true
  }
  return false
}

/* look up a student answer by ORIGINAL question index */
function lookupAnswer(ans: any, idx: number): any {
  try {
    if (Array.isArray(ans)) return ans[idx]
    if (ans !== null && typeof ans === 'object') {
      return ans[idx] !== undefined ? ans[idx] : ans[String(idx)]
    }
  } catch (e) {}
  return undefined
}

export async function POST(request) {
  try {
    var body = await request.json()
    var studentId = body.studentId
    var examId = body.examId
    var answers = body.answers

    if (!studentId || !examId || answers === undefined || answers === null) {
      return NextResponse.json({ error: 'بيانات مفقودة' }, { status: 400 })
    }

    await ensureTable()

    // Check double submission
    try {
      var existing = await db.$queryRawUnsafe(
        'SELECT id FROM ExamResult WHERE studentId = ? AND examId = ? LIMIT 1',
        studentId, examId
      )
      if (existing && existing.length > 0) {
        return NextResponse.json({ alreadySubmitted: true, submitted: true, blocked: true }, { status: 200 })
      }
    } catch (e) {
      console.error('Check existing exam result error:', e)
    }

    // Fetch exam
    var exam = null
    try {
      var examRows = await db.$queryRawUnsafe(
        'SELECT id, title, questions, passScore FROM Exam WHERE id = ? LIMIT 1',
        examId
      )
      exam = examRows && examRows.length > 0 ? examRows[0] : null
    } catch (e) {
      console.error('Fetch exam error:', e)
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 })
    }
    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 })
    }

    // Parse questions
    var questions = []
    if (exam.questions) {
      try {
        var raw = typeof exam.questions === 'string' ? JSON.parse(exam.questions) : exam.questions
        if (Array.isArray(raw)) { questions = raw }
      } catch (e) {
        console.error('Parse exam questions error:', e)
      }
    }
    if (questions.length === 0) {
      return NextResponse.json({ error: 'لا توجد أسئلة في هذا الامتحان' }, { status: 400 })
    }

    // Separate MCQ from writing questions — track original index
    var mcqQuestions: any[] = []
    var writingQuestions: any[] = []
    questions.forEach(function(q, idx) {
      var isWriting = q.type === 'writing' || q.type === 'essay'
      if (!isWriting && Array.isArray(q.options)) {
        var allNA = q.options.length > 0 && q.options.every(function(o) { return !o || o === 'N/A' || o === 'لا يوجد' || String(o).trim() === '' })
        if (allNA) isWriting = true
      }
      if (!isWriting && (!q.options || q.options.length === 0)) isWriting = true
      if (isWriting) writingQuestions.push({ q: q, origIdx: idx })
      else mcqQuestions.push({ q: q, origIdx: idx })
    })

    // Grade MCQ locally (instant)
    var score = 0
    var maxScore = 0
    mcqQuestions.forEach(function(item) {
      var q = item.q
      var pts = (typeof q.points === 'number' && q.points > 0) ? q.points : 1
      maxScore += pts
      var opts = Array.isArray(q.options) ? q.options : []
      var correctIdx = typeof q.correct === 'number' ? q.correct : 0
      if (correctIdx < 0 || correctIdx >= opts.length) { correctIdx = 0 }
      var studentAnswer = lookupAnswer(answers, item.origIdx)
      if (studentAnswer !== undefined && studentAnswer !== null && Number(studentAnswer) === correctIdx) {
        score += pts
      }
    })
    if (mcqQuestions.length > 0 && maxScore === 0) { maxScore = mcqQuestions.length }
    var mcqScore = score

    // Writing questions: counted in maxScore, graded in background
    var writingAnswers: any[] = []
    writingQuestions.forEach(function(item) {
      var q = item.q
      var pts = (typeof q.points === 'number' && q.points > 0) ? q.points : 5
      maxScore += pts
      var sa = lookupAnswer(answers, item.origIdx)
      var studentText = typeof sa === 'string' ? sa : (sa === undefined || sa === null ? '' : String(sa))
      writingAnswers.push({
        question: q.question || q.q || '',
        answer: studentText,
        points: pts,
        maxPoints: pts,
        modelAnswer: q.modelAnswer || q.answer || '',
        acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
        needsGrading: true,
        gradingStatus: 'pending',
        feedback: 'جاري التصحيح بالذكاء الاصطناعي...',
      })
    })

    if (maxScore === 0) { maxScore = questions.length }

    // Save with answers + pending writing verdicts
    var resultId = 'exr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    var answersJson = ''
    if (answers !== undefined && answers !== null) {
      try { answersJson = JSON.stringify(answers) } catch(e) { answersJson = '' }
    }

    var inserted = false
    try {
      await db.$executeRawUnsafe(
        'INSERT INTO ExamResult (id, studentId, examId, score, maxScore, answers, writingResults, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        resultId, studentId, examId, score, maxScore, answersJson, JSON.stringify(writingAnswers)
      )
      inserted = true
    } catch (insertErr) {
      console.error('Insert exam result error:', insertErr)
      try {
        await db.$executeRawUnsafe(
          'INSERT INTO ExamResult (id, studentId, examId, score, maxScore, answers) VALUES (?, ?, ?, ?, ?, ?)',
          resultId, studentId, examId, score, maxScore, answersJson
        )
        inserted = true
      } catch (retryErr) {
        console.error('Retry insert exam result error:', retryErr)
        return NextResponse.json({ error: 'حدث خطأ أثناء تسليم الامتحان' }, { status: 500 })
      }
    }

    var hasWriting = writingAnswers.length > 0

    // ============ BACKGROUND: grade ALL writing questions IN PARALLEL ============
    var gradeOneWriting = async function(wa: any) {
      var answerText = (wa.answer || '').trim()

      var mediaIds = extractImageMediaIds(answerText)
      if (mediaIds.length > 0) {
        try {
          var gradeData = await gradeImageAnswer({
            mediaId: mediaIds[0],
            question: wa.question,
            modelAnswer: wa.modelAnswer,
            acceptedAnswers: wa.acceptedAnswers,
            maxPoints: wa.points,
          })
          if (gradeData.needsGrading) {
            return Object.assign({}, wa, {
              gradingStatus: 'manual',
              needsGrading: true,
              isCorrect: false,
              awardedPoints: 0,
              aiExtractedAnswer: gradeData.extractedAnswer || '(تعذر الاستخراج)',
              aiIsCorrect: false,
              aiFeedback: gradeData.feedback || 'محتاجة مراجعة يدوية',
              aiAwardedPoints: 0,
              feedback: gradeData.feedback || 'محتاجة مراجعة يدوية',
            })
          }
          return Object.assign({}, wa, {
            gradingStatus: 'graded',
            needsGrading: false,
            aiExtractedAnswer: gradeData.extractedAnswer || '',
            aiIsCorrect: gradeData.isCorrect === true,
            aiFeedback: gradeData.feedback || '',
            aiAwardedPoints: gradeData.awardedPoints || 0,
            isCorrect: gradeData.isCorrect === true,
            awardedPoints: gradeData.awardedPoints || 0,
          })
        } catch (gradeErr) {
          console.error('[EXAM BG] AI grade image error:', gradeErr)
          return Object.assign({}, wa, {
            gradingStatus: 'manual',
            needsGrading: true,
            isCorrect: false,
            awardedPoints: 0,
            aiExtractedAnswer: '(فشل الـ AI في قراءة الصورة)',
            aiIsCorrect: false,
            aiFeedback: 'فشل التصحيح بالـ AI - هتتراجع من المستر',
            aiAwardedPoints: 0,
            feedback: 'فشل التصحيح بالـ AI - هتتراجع من المستر',
          })
        }
      }

      if (!answerText || answerText === '[📷 صورة مرفقة]') {
        return Object.assign({}, wa, {
          gradingStatus: 'graded',
          needsGrading: false,
          isCorrect: false,
          awardedPoints: 0,
          feedback: 'Not answered',
        })
      }
      if (!wa.modelAnswer) {
        return Object.assign({}, wa, {
          gradingStatus: 'manual',
          needsGrading: true,
          feedback: 'لا توجد إجابة نموذجية - يحتاج تصحيح يدوي',
        })
      }
      if (quickTextMatch(answerText, wa.modelAnswer, wa.acceptedAnswers)) {
        return Object.assign({}, wa, {
          gradingStatus: 'graded',
          needsGrading: false,
          isCorrect: true,
          awardedPoints: wa.points,
          aiExtractedAnswer: answerText,
          aiIsCorrect: true,
          aiFeedback: 'إجابة صحيحة (تطابق نصي)',
          aiAwardedPoints: wa.points,
          feedback: 'إجابة صحيحة',
        })
      }
      try {
        var textGrade = await gradeTextAnswer({
          question: wa.question,
          studentAnswer: answerText,
          modelAnswer: wa.modelAnswer,
          acceptedAnswers: wa.acceptedAnswers,
          maxPoints: wa.points,
        })
        if (textGrade) {
          if (textGrade.needsGrading) {
            return Object.assign({}, wa, {
              gradingStatus: 'manual',
              needsGrading: true,
              isCorrect: false,
              awardedPoints: 0,
              aiExtractedAnswer: answerText,
              aiIsCorrect: false,
              aiFeedback: textGrade.feedback || 'محتاجة مراجعة يدوية',
              aiAwardedPoints: 0,
              feedback: textGrade.feedback || 'محتاجة مراجعة يدوية',
            })
          }
          return Object.assign({}, wa, {
            gradingStatus: 'graded',
            needsGrading: false,
            isCorrect: textGrade.isCorrect === true,
            awardedPoints: textGrade.awardedPoints || 0,
            aiExtractedAnswer: answerText,
            aiIsCorrect: textGrade.isCorrect === true,
            aiFeedback: textGrade.feedback || '',
            aiAwardedPoints: textGrade.awardedPoints || 0,
            feedback: textGrade.feedback || '',
          })
        }
        return Object.assign({}, wa, {
          gradingStatus: 'manual',
          needsGrading: true,
          feedback: 'التصحيح الذكي تعذر — هتتراجع من المستر',
        })
      } catch (textGradeErr) {
        console.error('[EXAM BG] AI text grading error:', textGradeErr)
        return Object.assign({}, wa, {
          gradingStatus: 'manual',
          needsGrading: true,
          feedback: 'التصحيح الذكي تعذر — هتتراجع من المستر',
        })
      }
    }

    var backgroundGrading = async function() {
      try {
        var gradedList = await Promise.all(writingAnswers.map(function(wa) { return gradeOneWriting(wa) }))
        var writingScore = 0
        gradedList.forEach(function(g) {
          if (g.gradingStatus === 'graded') writingScore += (g.awardedPoints || 0)
        })
        var finalScore = mcqScore + writingScore
        try {
          await db.$executeRawUnsafe(
            'UPDATE ExamResult SET score = ?, writingResults = ? WHERE id = ?',
            finalScore, JSON.stringify(gradedList), resultId
          )
          console.log('[EXAM BG] Grading done for', resultId, '— final score', finalScore + '/' + maxScore)
        } catch (updErr) {
          console.error('[EXAM BG] Update result error:', updErr)
          try {
            await db.$executeRawUnsafe(
              'UPDATE ExamResult SET score = ? WHERE id = ?',
              finalScore, resultId
            )
          } catch (e2) {}
        }
      } catch (bgErr) {
        console.error('[EXAM BG] Background grading fatal error:', bgErr)
      }
    }

    if (hasWriting && inserted) {
      after(backgroundGrading)
    }

    return NextResponse.json({ success: true, submitted: true, pendingGrading: hasWriting })
  } catch (error) {
    console.error('Exam submit error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسليم الامتحان' }, { status: 500 })
  }
}
