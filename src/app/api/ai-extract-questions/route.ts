// @ts-nocheck
// FILE: src/app/api/ai-extract-questions/route.ts
// ROUTE: POST /api/ai-extract-questions
// PURPOSE: Save extracted questions to database (exam or homework)
//          Called from AIExtractionPanel Step 3 after user reviews.
//          PRESERVES question types (mcq + writing/مقالي) with modelAnswer,
//          points and acceptedAnswers — same contract as /api/ai/extract-and-save.

import { NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'
import { ensureExamSettingsColumns } from '@/lib/ensure-schema'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    var formData = await request.formData()
    var type = formData.get('type') || 'exam'
    var grade = formData.get('grade') || ''
    var title = formData.get('title') || ''
    var questionsJson = formData.get('questions') || ''
    // (2026-و25 نقل 25-b1) إعدادات الامتحان من خطوة المراجعة — مسار الحفظ
    // الخاص بالقائد (المستخرج بيتحفظ من هنا)
    var showResult = String(formData.get('showResult') || '') === 'true'
    var timeLimitMin = parseInt(String(formData.get('timeLimitMin') || ''), 10)
    if (isNaN(timeLimitMin) || timeLimitMin < 0) timeLimitMin = 0
    var scheduledAt: Date | null = null
    var rawScheduled = String(formData.get('scheduledAt') || '')
    if (rawScheduled) {
      try {
        var sd = new Date(rawScheduled)
        if (!isNaN(sd.getTime())) scheduledAt = sd
      } catch (e) { scheduledAt = null }
    }

    // defensive ALTERs — الأعمدة الجديدة موجودة قبل أي كتابة
    await ensureExamSettingsColumns(function (sql: string) { return db.$executeRawUnsafe(sql) })

    console.log('Save request:', { type: type, grade: grade, title: title, hasQuestions: !!questionsJson })

    if (!grade.trim()) {
      return NextResponse.json({ error: 'Grade is required' }, { status: 400 })
    }
    if (!title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!questionsJson.trim()) {
      return NextResponse.json({ error: 'No questions provided' }, { status: 400 })
    }

    var extractedQuestions = []
    try {
      extractedQuestions = JSON.parse(questionsJson)
    } catch (e) {
      console.error('JSON parse error:', e)
      return NextResponse.json({ error: 'Invalid questions format' }, { status: 400 })
    }

    if (!Array.isArray(extractedQuestions) || extractedQuestions.length === 0) {
      return NextResponse.json({ error: 'No valid questions' }, { status: 400 })
    }

    // Convert to DB format — preserve type/writing/modelAnswer/points
    var dbQuestions = extractedQuestions.map(function(q) {
      var questionText = q.question || q.q || ''
      var isWriting = q.type === 'writing' || q.type === 'essay'
      if (!isWriting && Array.isArray(q.options)) {
        var allNA = q.options.length > 0 && q.options.every(function(o) { return !o || o === 'N/A' || o === 'لا يوجد' || String(o).trim() === '' })
        if (allNA) isWriting = true
      }
      if (!isWriting && (!q.options || q.options.length === 0)) {
        isWriting = true
      }
      if (isWriting) {
        var wPts = (typeof q.points === 'number' && q.points > 0) ? q.points : 5
        return {
          type: 'writing',
          question: questionText,
          options: [],
          correct: -1,
          points: wPts,
          modelAnswer: q.modelAnswer || q.answer || '',
          acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
        }
      }
      var pts = (typeof q.points === 'number' && q.points > 0) ? q.points : 1

      // Shuffle question order
      // (shuffle options and update correct index)
      var opts = Array.isArray(q.options) ? q.options.slice(0, 4) : ['N/A', 'N/A', 'N/A', 'N/A']
      while (opts.length < 4) { opts.push('N/A') }
      var correctIdx = typeof q.correct === 'number' ? q.correct : 0
      if (correctIdx < 0 || correctIdx >= opts.length) { correctIdx = 0 }
      var correctText = opts[correctIdx]
      var shuffled = opts.slice()
      for (var oi = shuffled.length - 1; oi > 0; oi--) {
        var oj = Math.floor(Math.random() * (oi + 1))
        var otemp = shuffled[oi]
        shuffled[oi] = shuffled[oj]
        shuffled[oj] = otemp
      }
      var newCorrect = shuffled.indexOf(correctText)
      if (newCorrect < 0) newCorrect = 0
      return {
        type: 'mcq',
        question: questionText,
        options: shuffled,
        correct: newCorrect,
        points: pts,
        modelAnswer: q.modelAnswer || '',
      }
    })

    // Shuffle overall question order (MCQs and writing mixed)
    for (var si = dbQuestions.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1))
      var stemp = dbQuestions[si]
      dbQuestions[si] = dbQuestions[sj]
      dbQuestions[sj] = stemp
    }

    var questionsStr = JSON.stringify(dbQuestions)
    var savedItem = null

    if (type === 'exam') {
      savedItem = await safeWrite(function() {
        return db.exam.create({
          data: {
            title: title.trim(),
            grade: grade,
            content: dbQuestions.length + ' questions extracted by AI',
            questions: questionsStr,
            passScore: 50,
            // (2026-و25 نقل 25-b1) إعدادات الامتحان
            showResult,
            timeLimitMin,
            scheduledAt,
          }
        })
      })
      return NextResponse.json({
        success: true,
        message: 'Exam saved successfully! (' + dbQuestions.length + ' questions)',
        examId: savedItem.id
      })
    } else {
      savedItem = await safeWrite(function() {
        return db.homework.create({
          data: {
            title: title.trim(),
            grade: grade,
            content: dbQuestions.length + ' questions extracted by AI',
            questions: questionsStr,
            // (2026-و25 نقل 25-b1) موعد ظهور الواجب
            scheduledAt,
          }
        })
      })
      return NextResponse.json({
        success: true,
        message: 'Homework saved successfully! (' + dbQuestions.length + ' questions)',
        homeworkId: savedItem.id
      })
    }
  } catch (error) {
    console.error('AI extract and save error:', error)
    return NextResponse.json({ error: 'Save error: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
