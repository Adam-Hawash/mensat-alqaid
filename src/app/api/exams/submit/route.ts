// @ts-nocheck
// POST /api/exams/submit - Submit exam answers, auto-grade, save result with answers
//
// GRADING FLOW (the teacher asked for FULL auto-grading — nothing left empty):
//   MCQ     → graded instantly (local)
//   Writing → graded RIGHT NOW during submit (no more pending/background):
//     - image answers ([📷 صورة مرفقة: …]) → VLM grading (gradeImageAnswer)
//     - text answers → smart grader (fast match + AI batch + deterministic fallback)
//   Final score (MCQ + writing) is saved together with per-question
//   writingGrades JSON so the student AND admin see the AI verdict everywhere.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gradeImageAnswer, gradeTextAnswer, extractImageMediaIds, finalAnswerCandidates } from '@/lib/ai-image-grader'
import { quickSmartMatch, gradeFallbackDecisive } from '@/lib/smart-grader'
/* (2026-و29) مسار gradeWritingSmart الجماعي اتشال من التسليم — كان نداء AI واحد
   لكل الأسئلة المقالية: أي 429/timeout/JSON مقطوع = فولباك للدفعة كلها = «كله غلط».
   دلوقتي تصحيح متسلسل سؤال-بسؤال (نفس إصلاح الواجب و25) — فشل سؤال ما يأثرش على غيره. */
import { parseQuestions, resolveQuestionsForStudent } from '@/lib/exam-models'

export const runtime = 'nodejs'
export const maxDuration = 300

/* (2026-و29) كاش على مستوى الموديول: كل ALTER = نداء شبكة لقاعدة البيانات — تنفيذها في كل ريكوست كان بيدفع نداءات ضاية في كل تحميل (من أكبر أسباب بطء المنصة) — دلوقتي مرة واحدة لكل instance */
var _examResultReady: Promise<void> | null = null
async function ensureTable() {
  if (!_examResultReady) {
    _examResultReady = (async function () {
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
    // writingResults column — persisted AI verdicts (legacy single source of truth)
    try { await db.$executeRawUnsafe('ALTER TABLE ExamResult ADD COLUMN writingResults TEXT DEFAULT ""') } catch(e) {}
    // writingGrades column — per-question grades keyed by ORIGINAL index (student UI + fast path)
    try { await db.$executeRawUnsafe('ALTER TABLE ExamResult ADD COLUMN writingGrades TEXT DEFAULT ""') } catch(e) {}
    // (2026-و25 نقل 25-b1) إعدادات الامتحان على جدول Exam — scheduledAt DATETIME
    // مش TEXT (درس موثق: Prisma بيكتب DateTime كـ epoch-millis وTEXT بيكسر القراءة)
    try { await db.$executeRawUnsafe('ALTER TABLE Exam ADD COLUMN showResult INTEGER DEFAULT 0') } catch(e) {}
    try { await db.$executeRawUnsafe('ALTER TABLE Exam ADD COLUMN timeLimitMin INTEGER DEFAULT 0') } catch(e) {}
    try { await db.$executeRawUnsafe('ALTER TABLE Exam ADD COLUMN scheduledAt DATETIME') } catch(e) {}
    try { await db.$executeRawUnsafe("ALTER TABLE Exam ADD COLUMN targetStudentIds TEXT DEFAULT ''") } catch(e) {}
    /* (2026-و29) استهداف المجموعات */
    try { await db.$executeRawUnsafe("ALTER TABLE Exam ADD COLUMN targetGroupIds TEXT DEFAULT ''") } catch(e) {}
  } catch (e) {
    console.error('Ensure ExamResult table error:', e)
  }
})()
  }
  await _examResultReady
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
        // (2026-و22) النماذج معانا — التسليم يتصحح على أسئلة نموذج الطالب نفسها
        // (2026-و25 نقل 25-b1) showResult معانا — بيتحدد هل الطالب يشوف تفاصيل الإجابات
        'SELECT id, title, questions, passScore, models, modelMode, fixedModel, showResult, targetStudentIds, targetGroupIds FROM Exam WHERE id = ? LIMIT 1',
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

    /* (2026-و26) حارس الاستهداف: الامتحان الموجه لطلاب محددين — التسليم
       مسموح للي اسمه في القايمة بس (حتى لو طلبه بنفسه بالـ API)
       (2026-و29) + استهداف المجموعات: عضو المجموعة المستهدفة مسموح برضه */
    try {
      var tParsed = JSON.parse(String((exam as any).targetStudentIds || '[]'))
      var gParsed: string[] = []
      try { var gpX = JSON.parse(String((exam as any).targetGroupIds || '[]')); if (Array.isArray(gpX)) gParsed = gpX } catch (e) {}
      var allowedHere = true
      var studentGroupHere = ''
      if ((Array.isArray(tParsed) && tParsed.length > 0) || gParsed.length > 0) {
        allowedHere = false
        if (Array.isArray(tParsed) && tParsed.indexOf(String(studentId)) !== -1) allowedHere = true
        if (!allowedHere && gParsed.length > 0) {
          try {
            var sgRowsHere = await db.$queryRawUnsafe('SELECT groupId FROM Student WHERE id = ? LIMIT 1', studentId) as any[]
            if (sgRowsHere && sgRowsHere.length > 0) studentGroupHere = String(sgRowsHere[0].groupId || '')
            if (studentGroupHere && gParsed.indexOf(studentGroupHere) !== -1) allowedHere = true
          } catch (sgErr) {}
        }
      }
      if (!allowedHere) {
        return NextResponse.json({ error: 'الامتحان ده مش موجه ليك — كلمني لو فيه غلط' }, { status: 403 })
      }
    } catch (e) {}

    // Parse questions — (2026-و22) الـ helper المشترك resolveQuestionsForStudent:
    // لو الامتحان فيه نماذج ← أسئلة نموذج الطالب هو هي الأصل للتصحيح
    // (حتى لو فيه أسئلة أساس — الطالب شاف النموذج بتاعه فلازم يتصحح عليه)،
    // والأساس بوابه احتياط. نفس الدالة اللي بتقرأ شاشات الأدمن — صفر تعارض.
    var questions = resolveQuestionsForStudent(exam, studentId, examId)
    if (questions.length === 0) {
      questions = parseQuestions(exam.questions)
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
      /* أسئلة اختيارية من غير مفتاح مؤكد ← صفر درجة صادق — مش (A) بالحر
         (نفس قرار maths-genius: التصحيح على الإجابة الرسمية بس) */
      var correctIdx = typeof q.correct === 'number' ? q.correct : -1
      if (correctIdx < 0 || correctIdx >= opts.length) {
        return
      }
      var studentAnswer = lookupAnswer(answers, item.origIdx)
      if (studentAnswer !== undefined && studentAnswer !== null && Number(studentAnswer) === correctIdx) {
        score += pts
      }
    })
    if (mcqQuestions.length > 0 && maxScore === 0) { maxScore = mcqQuestions.length }

    // ===== WRITING: full AI grading NOW (inline — nothing stays pending) =====
    /* (2026-و25 نقل 25-a) — partial persist: صف النتيجة بيتعمل من أول لحظة
       (المقالي كلّه pending) وبيتحدّث بعد كل مرحلة/سؤال — لو السيرفلس اتقطع في
       نص التصحيح، اللي اتصحح محفوظ والباقي pending والإصلاح الذاتي (sweep /
       self-heal في exam-results) بيكملهم — مفيش شغل بيضيع ولا صفر صامت. */
    var mcqScore = score
    var writingScore = 0
    var writingGrades: any[] = []
    var gradesByOrig: Record<number, any> = {}

    // 1) build the writing workload first (original index tracked for every question)
    var textWorkload: any[] = []   // for gradeWritingSmart (batch, one AI call)
    var imageWorkload: any[] = []  // for gradeImageAnswer (per question, VLM)
    writingQuestions.forEach(function(item) {
      var q = item.q
      var pts = (typeof q.points === 'number' && q.points > 0) ? q.points : 5
      maxScore += pts
      var sa = lookupAnswer(answers, item.origIdx)
      var studentText = typeof sa === 'string' ? sa : (sa === undefined || sa === null ? '' : String(sa))
      var wl = {
        origIdx: item.origIdx,
        question: q.question || q.q || '',
        modelAnswer: q.modelAnswer || q.answer || '',
        acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
        points: pts,
        studentText: studentText,
      }
      var mediaIds = extractImageMediaIds(studentText)
      if (mediaIds.length > 0) imageWorkload.push(wl)
      else textWorkload.push(wl)
    })

    // كل سؤال مقالي يبدأ pending — بيتبدل بحكمه لما يتصحح
    textWorkload.forEach(function(w) {
      gradesByOrig[w.origIdx] = {
        question: w.question, answer: w.studentText, modelAnswer: w.modelAnswer,
        awardedPoints: 0, maxPoints: w.points, isCorrect: false,
        feedback: 'جاري التصحيح بالذكاء الاصطناعي...', gradingStatus: 'pending',
      }
    })
    imageWorkload.forEach(function(w) {
      gradesByOrig[w.origIdx] = {
        question: w.question, answer: w.studentText, modelAnswer: w.modelAnswer,
        awardedPoints: 0, maxPoints: w.points, isCorrect: false,
        feedback: 'جاري التصحيح بالذكاء الاصطناعي...', gradingStatus: 'pending',
      }
    })

    var buildGradesInOrder = function() {
      var out: any[] = []
      writingQuestions.forEach(function(wItem) {
        var gr = gradesByOrig[wItem.origIdx]
        if (gr) {
          out.push({
            origIdx: wItem.origIdx,
            question: gr.question,
            answer: gr.answer,
            modelAnswer: gr.modelAnswer,
            awardedPoints: gr.awardedPoints,
            maxPoints: gr.maxPoints,
            isCorrect: gr.isCorrect,
            feedback: gr.feedback,
            gradingStatus: gr.gradingStatus || 'graded',
            aiExtractedAnswer: gr.aiExtractedAnswer || '',
          })
        }
      })
      return out
    }

    var resultId = 'exr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    var answersJson = ''
    if (answers !== undefined && answers !== null) {
      try { answersJson = JSON.stringify(answers) } catch(e) { answersJson = '' }
    }

    // early INSERT — الصف موجود من دلوقتي بمقالي pending ودرجة الاختياري بس
    var rowPersisted = false
    try {
      var pendingJson = JSON.stringify(buildGradesInOrder())
      await db.$executeRawUnsafe(
        'INSERT INTO ExamResult (id, studentId, examId, score, maxScore, answers, writingResults, writingGrades, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        resultId, studentId, examId, mcqScore, maxScore, answersJson, pendingJson, pendingJson
      )
      rowPersisted = true
    } catch (earlyInsertErr) {
      console.error('Early insert exam result error (سيتكمل بالحفظ النهائي):', earlyInsertErr)
    }

    var persistExamGrades = async function() {
      if (!rowPersisted) return
      try {
        var gradesJson = JSON.stringify(buildGradesInOrder())
        await db.$executeRawUnsafe(
          'UPDATE ExamResult SET score = ?, writingResults = ?, writingGrades = ? WHERE id = ?',
          mcqScore + writingScore, gradesJson, gradesJson, resultId
        )
      } catch (pErr) {
        console.error('Partial persist exam grades error:', pErr)
      }
    }

    // 2) text answers → (2026-و29) تصحيح متسلسل سؤال-بسؤال — نفس نمط الواجب بالظبط:
    //    1) مطابقة سريعة محلية (quickSmartMatch) → كاملة من غير AI
    //    2) AI لكل سؤال لوحده (gradeTextAnswer — فيه تحقق قيم مدمج STRICT VERIFY)
    //    3) فشل/عدم تأكد → فولباك حاسم للسؤال ده بس (مش الدفعة كلها)
    //    + partial persist بعد كل سؤال — اللي اتصحح مش بيضيع لو اتقطعنا
    var textGraded: any[] = []
    try {
      for (var tw = 0; tw < textWorkload.length; tw++) {
        var twItem = textWorkload[tw]
        var twAnswer = twItem.studentText || ''
        var graded1: any = null
        if (!twAnswer.trim() || twAnswer.trim() === '[📷 صورة مرفقة]') {
          graded1 = {
            question: twItem.question, answer: twAnswer, modelAnswer: twItem.modelAnswer,
            awardedPoints: 0, maxPoints: twItem.points, isCorrect: false,
            feedback: 'لم يتم الإجابة', gradingStatus: 'graded',
          }
        } else if (quickSmartMatch(twAnswer, twItem.modelAnswer || '', twItem.acceptedAnswers || []) === true) {
          /* (و24) ملاحظة شخصية زي معلم بيتكلم مع الطالب — حتى في المسار السريع */
          var stNote = (finalAnswerCandidates(twAnswer)[0] || twAnswer.trim() || '').slice(0, 40)
          graded1 = {
            question: twItem.question, answer: twAnswer, modelAnswer: twItem.modelAnswer,
            awardedPoints: twItem.points, maxPoints: twItem.points, isCorrect: true,
            feedback: 'برافو عليك ✓ الإجابة النهائية (' + stNote + ') مطابقة للإجابة الصحيحة',
            gradingStatus: 'graded',
          }
        } else {
          var tGrade1: any = null
          try {
            tGrade1 = await gradeTextAnswer({
              question: twItem.question,
              studentAnswer: twAnswer,
              modelAnswer: twItem.modelAnswer || '',
              acceptedAnswers: twItem.acceptedAnswers || [],
              maxPoints: twItem.points,
            })
          } catch (tgErr) { console.error('[exam-submit] text grade error:', tgErr) }
          if (tGrade1 && !tGrade1.needsGrading) {
            graded1 = {
              question: twItem.question, answer: twAnswer, modelAnswer: twItem.modelAnswer,
              awardedPoints: tGrade1.awardedPoints || 0, maxPoints: twItem.points,
              isCorrect: tGrade1.isCorrect === true,
              feedback: tGrade1.feedback || (tGrade1.isCorrect ? 'إجابة صحيحة' : 'إجابة مختلفة عن الإجابة الصحيحة'),
              gradingStatus: 'graded',
            }
          } else {
            /* AI فشل أو مش متأكد في السؤال ده بس → فولباك حاسم —
               تكافؤ القيم → كاملة، علاقة بالحل → نص درجة + مراجعة */
            graded1 = gradeFallbackDecisive({
              question: twItem.question, answer: twAnswer,
              modelAnswer: twItem.modelAnswer || '',
              acceptedAnswers: twItem.acceptedAnswers || [],
              points: twItem.points,
            })
          }
        }
        textGraded[tw] = graded1
        await persistExamGrades()
      }
    } catch (grErr) {
      console.error('Exam writing grade error:', grErr)
      for (var tw2 = 0; tw2 < textWorkload.length; tw2++) {
        if (!textGraded[tw2]) {
          try {
            textGraded[tw2] = gradeFallbackDecisive({
              question: textWorkload[tw2].question,
              answer: textWorkload[tw2].studentText,
              modelAnswer: textWorkload[tw2].modelAnswer || '',
              acceptedAnswers: textWorkload[tw2].acceptedAnswers || [],
              points: textWorkload[tw2].points,
            })
          } catch (fbErr) {
            textGraded[tw2] = {
              question: textWorkload[tw2].question, answer: textWorkload[tw2].studentText,
              modelAnswer: textWorkload[tw2].modelAnswer,
              awardedPoints: 0, maxPoints: textWorkload[tw2].points, isCorrect: false,
              feedback: 'لم يتم الإجابة', gradingStatus: 'graded',
            }
          }
        }
      }
    }
    for (var tx = 0; tx < textWorkload.length; tx++) {
      var tGrade = textGraded[tx] || null
      if (!tGrade) {
        try {
          tGrade = gradeFallbackDecisive({
            question: textWorkload[tx].question, answer: textWorkload[tx].studentText,
            modelAnswer: textWorkload[tx].modelAnswer, acceptedAnswers: textWorkload[tx].acceptedAnswers,
            points: textWorkload[tx].points,
          })
        } catch (fbErr2) {
          tGrade = {
            question: textWorkload[tx].question, answer: textWorkload[tx].studentText, modelAnswer: textWorkload[tx].modelAnswer,
            awardedPoints: 0, maxPoints: textWorkload[tx].points, isCorrect: false,
            feedback: 'لم يتم الإجابة', gradingStatus: 'graded',
          }
        }
      }
      writingScore += Number(tGrade.awardedPoints) || 0
      gradesByOrig[textWorkload[tx].origIdx] = tGrade
    }
    // persist بعد مرحلة النصوص
    await persistExamGrades()

    // 3) image answers → VLM per question (بتسلسل + persist بعد كل سؤال)
    var imageGraded: any[] = []
    for (var im = 0; im < imageWorkload.length; im++) {
      var iw = imageWorkload[im]
      var mediaIds2 = extractImageMediaIds(iw.studentText)
      var gradeData: any = null
      try {
        gradeData = await gradeImageAnswer({
          mediaId: mediaIds2[0],
          question: iw.question,
          modelAnswer: iw.modelAnswer,
          acceptedAnswers: iw.acceptedAnswers,
          maxPoints: iw.points,
        })
      } catch (imErr) {
        console.error('Writing image grade error:', imErr)
      }
      if (gradeData && gradeData.needsGrading !== true) {
        /* حكم الـ AI الواثق على الإجابة النهائية — نهائي: صح/غلط */
        var imAwarded = Math.min(Math.max(Math.round(Number(gradeData.awardedPoints) || (gradeData.isCorrect ? iw.points : 0)), 0), iw.points)
        var imGrade = {
          question: iw.question,
          answer: iw.studentText,
          modelAnswer: iw.modelAnswer,
          awardedPoints: imAwarded,
          maxPoints: iw.points,
          isCorrect: imAwarded >= Math.ceil(iw.points * 0.5) && imAwarded > 0,
          feedback: gradeData.feedback || (imAwarded > 0 ? 'تم تصحيح صورة الحل' : 'الحل مش مطابق'),
          gradingStatus: 'graded',
          aiExtractedAnswer: gradeData.extractedAnswer || '',
        }
        imageGraded.push(imGrade)
        writingScore += Number(imGrade.awardedPoints) || 0
        gradesByOrig[iw.origIdx] = imGrade
      } else {
        /* الحسم الحاسم (نفس decisiveImageFallback بتاع الواجب):
           الـ VLM فشل أو مش متأكد ← مفيش needsGrading معلقة خالص —
           درجة مؤقتة عادلة (نص درجة المحاولة) والمستر يعدّلها من لوحته */
        var hasRealWork = iw.studentText.replace(/\[📷[^\]]*\]/g, '').trim().length > 0
        var fbGrade = {
          question: iw.question,
          answer: iw.studentText,
          modelAnswer: iw.modelAnswer,
          awardedPoints: hasRealWork ? Math.ceil(iw.points / 2) : 0,
          maxPoints: iw.points,
          isCorrect: false,
          feedback: hasRealWork ? 'صورة الحل اترفعت — درجة مؤقتة والمستر هيراجعها ويعادلها' : 'لم يتم الإجابة',
          gradingStatus: 'graded',
        }
        imageGraded.push(fbGrade)
        writingScore += Number(fbGrade.awardedPoints) || 0
        gradesByOrig[iw.origIdx] = fbGrade
      }
      // persist بعد كل سؤال صورة
      await persistExamGrades()
    }

    // keep grades in the ORIGINAL question order for display
    writingGrades = buildGradesInOrder()

    score = mcqScore + writingScore

    if (maxScore === 0) { maxScore = questions.length }

    // الحفظ النهائي — لو الصف موجود من الـ early insert بنحدّثه، وإلا INSERT زي ما هو
    if (rowPersisted) {
      await persistExamGrades()
    } else {
      var writingGradesJson = ''
      try { writingGradesJson = JSON.stringify(writingGrades) } catch(e) { writingGradesJson = '' }
      try {
        await db.$executeRawUnsafe(
          'INSERT INTO ExamResult (id, studentId, examId, score, maxScore, answers, writingResults, writingGrades, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          resultId, studentId, examId, score, maxScore, answersJson, writingGradesJson, writingGradesJson
        )
      } catch (insertErr) {
        console.error('Insert exam result error:', insertErr)
        try {
          await db.$executeRawUnsafe(
            'INSERT INTO ExamResult (id, studentId, examId, score, maxScore, answers, submittedAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            resultId, studentId, examId, score, maxScore, answersJson
          )
        } catch (retryErr) {
          console.error('Retry insert exam result error:', retryErr)
          return NextResponse.json({ error: 'حدث خطأ أثناء تسليم الامتحان' }, { status: 500 })
        }
      }
    }

    // (2026-و25 نقل 25-b1) بناء تفاصيل الاختياري للطالب — من نفس حساب الاختياري
    // الموجود فوق بالظبط (نفس lookupAnswer + نفس مقارنة correctIdx) عشان العرض
    // يتسق مع الدرجة المحسوبة: إجابته كنص الخيار + الصح + صح/غلط + نقاط السؤال
    var buildMcqResults = function() {
      var out: any[] = []
      mcqQuestions.forEach(function(item) {
        var q = item.q
        var pts = (typeof q.points === 'number' && q.points > 0) ? q.points : 1
        var opts = Array.isArray(q.options) ? q.options : []
        var correctIdx = typeof q.correct === 'number' ? q.correct : -1
        var hasKey = correctIdx >= 0 && correctIdx < opts.length
        var studentAnswer = lookupAnswer(answers, item.origIdx)
        var saNum = (studentAnswer === undefined || studentAnswer === null) ? -1 : Number(studentAnswer)
        // إجابة الطالب كنص الخيار عشان الطالب يشوف كلامه — ولو الرقم بره الحدود/مش رقم يظهر زي ما هو
        var studentText = ''
        if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') studentText = 'لم يتم الإجابة'
        else if (typeof saNum === 'number' && !isNaN(saNum) && saNum >= 0 && saNum < opts.length) studentText = String(opts[saNum])
        else studentText = String(studentAnswer)
        // اختياري من غير مفتاح مؤكد ← isCorrect:false + correctAnswer:'' + needsManualKey
        // (ملاحظة داخلية للمستر — مش بتتعمل فلترة للطالب)
        out.push({
          origIdx: item.origIdx,
          question: q.question || q.q || '',
          studentAnswer: studentText,
          correctAnswer: hasKey ? String(opts[correctIdx]) : '',
          isCorrect: hasKey && saNum === correctIdx,
          points: pts,
          needsManualKey: !hasKey,
        })
      })
      return out
    }

    // (2026-و25 نقل 25-b1) رد التسليم بحالتين:
    // showResult=false (افتراضي) → نفس رد القائد الحالي حرفيًا
    // showResult=true → + تفاصيل كل سؤال اختياري + بانر المقالي لو لسه بيتصحح
    /* (2026-و29) الدرجة العظمى للاختياري لوحده — عشان هيدر النتيجة الفورية
       «درجتك في الاختياري» يعرض mcqScore/mcqMaxScore صح بدل إجمالي شامل المقالي */
    var mcqMaxScore = 0
    mcqQuestions.forEach(function (item) {
      var pts = (typeof item.q.points === 'number' && item.q.points > 0) ? item.q.points : 1
      mcqMaxScore += pts
    })

    var showResultEnabled = false
    try { showResultEnabled = exam.showResult === 1 || exam.showResult === true || exam.showResult === 'true' } catch (e) { showResultEnabled = false }

    var responsePayload: Record<string, any> = {
      success: true,
      submitted: true,
      score: score,
      maxScore: maxScore,
      writingGrades: writingGrades,
    }
    if (showResultEnabled) {
      responsePayload.showResult = true
      responsePayload.message = 'تم تسليم الامتحان بنجاح'
      responsePayload.mcqScore = mcqScore
      responsePayload.mcqMaxScore = mcqMaxScore
      responsePayload.writingPending = writingGrades.some(function(g) { return g.gradingStatus === 'pending' })
      responsePayload.mcqResults = buildMcqResults()
    }
    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('Exam submit error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسليم الامتحان' }, { status: 500 })
  }
}
