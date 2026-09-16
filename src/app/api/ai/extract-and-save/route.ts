// @ts-nocheck
// FILE: src/app/api/ai/extract-and-save/route.ts
// ROUTE: POST /api/ai/extract-and-save
// PURPOSE: Save already-extracted questions to database (exam or homework)
//          Receives pre-extracted questions JSON from AdminDashboard review step

import { NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    var formData = await request.formData()
    var type = formData.get('type') || 'exam'
    var grade = formData.get('grade') || ''
    var title = formData.get('title') || ''
    var questionsJson = formData.get('questions') || '[]'

    if (!grade.trim()) {
      return NextResponse.json({ error: 'Grade is required' }, { status: 400 })
    }
    if (!title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    var questions = []
    try {
      questions = JSON.parse(questionsJson)
    } catch (e) {
      return NextResponse.json({ error: 'Invalid questions format' }, { status: 400 })
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'No questions to save' }, { status: 400 })
    }

    /* (و46) سؤال اختياراته صور/رسومات (optionFigures) = اختياري **مطلقًا مقالي** —
       طلب المستر الحرفي: «الأسئلة اللي فيها اختيارات على شكل رسم ما بتتضافش…
       عايز الرسمة تكون شكلها صغير عشان الطالب يقدر يختار». قبل كده الحرس
       كان شايف الاختيارات كلها N/A فبيحوّل السؤال مقالي ويتمسح الاختيارات
       — فالطالب كان يلاقي السؤال من غير أي اختيارات خالص! */
    function serverHasVisualOptions(q: any): boolean {
      if (!q || typeof q !== 'object' || !Array.isArray(q.optionFigures)) return false
      return q.optionFigures.some(function (ofg: any) {
        return ofg && typeof ofg === 'object' && ((typeof ofg.url === 'string' && ofg.url) || ofg.bbox)
      })
    }

    // Convert to DB format - preserve ALL fields (type, modelAnswer, acceptedAnswers)
    var dbQuestions = questions.map(function(q) {
      var questionText = q.question || q.q || ''
      var isWriting = q.type === 'writing' || q.type === 'essay'
      /* (و46) رسومات الاختيارات → اختياري دايمًا حتي لو النصوص كلها N/A */
      var hasVisual = serverHasVisualOptions(q)
      if (hasVisual) isWriting = false
      if (!isWriting && Array.isArray(q.options)) {
        var allNA = q.options.length > 0 && q.options.every(function(o) { return !o || o === 'N/A' || o === 'لا يوجد' || String(o).trim() === '' })
        if (allNA && !hasVisual) isWriting = true
      }
      if (!isWriting && (!q.options || q.options.length === 0) && !hasVisual) {
        isWriting = true
      }
      var pts = (typeof q.points === 'number' && q.points > 0) ? q.points : (isWriting ? 5 : 1)
      if (isWriting) {
        return {
          type: 'writing',
          question: questionText,
          options: [],
          correct: -1,
          points: pts,
          modelAnswer: q.modelAnswer || q.answer || '',
          acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
        }
      }
      var opts = Array.isArray(q.options) ? q.options.slice(0, 4) : []
      /* (و46) سؤال الرسومات: نملأ الاختيارات بنفس عدد الرسومات على الأقل —
         نص فاضي = الاختيار صورة بس (الطالب يشوف الرسمة الصغيرة ويختارها) */
      var minOpts = hasVisual && Array.isArray(q.optionFigures) ? q.optionFigures.length : 0
      while (opts.length < Math.max(4, minOpts)) { opts.push('') }
      var correctIdx = typeof q.correct === 'number' ? q.correct : 0
      if (correctIdx < 0 || correctIdx >= opts.length) { correctIdx = 0 }
      return {
        type: 'mcq',
        question: questionText,
        options: opts,
        correct: correctIdx,
        points: pts,
        modelAnswer: q.modelAnswer || '',
      }
    })

    var questionsStr = JSON.stringify(dbQuestions)
    var savedItem = null

    if (type === 'exam') {
      savedItem = await safeWrite(function() {
        return db.exam.create({
          data: {
            title: title.trim(),
            grade: grade,
            content: questions.length + ' questions extracted by AI',
            questions: questionsStr,
            passScore: 50
          }
        })
      })
      return NextResponse.json({
        success: true,
        message: 'Exam saved successfully! (' + questions.length + ' questions)',
        examId: savedItem.id
      })
    } else {
      savedItem = await safeWrite(function() {
        return db.homework.create({
          data: {
            title: title.trim(),
            grade: grade,
            content: questions.length + ' questions extracted by AI',
            questions: questionsStr
          }
        })
      })
      return NextResponse.json({
        success: true,
        message: 'Homework saved successfully! (' + questions.length + ' questions)',
        homeworkId: savedItem.id
      })
    }
  } catch (error) {
    console.error('AI extract and save error:', error)
    return NextResponse.json({ error: 'Save error: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
