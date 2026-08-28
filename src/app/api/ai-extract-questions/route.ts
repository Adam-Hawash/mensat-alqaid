// @ts-nocheck
// FILE: src/app/api/ai-extract-questions/route.ts
// ROUTE: POST /api/ai-extract-questions
// PURPOSE: Save pre-extracted questions to database
//          Called from AIExtractionPanel Step 3 after user reviews
//          Receives: type, grade, title, questions (JSON string)

import { NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    var formData = await request.formData()
    var type = formData.get('type') || 'exam'
    var grade = formData.get('grade') || ''
    var title = formData.get('title') || ''
    var questionsJson = formData.get('questions') || ''

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

    // Shuffle question order
    for (var si = extractedQuestions.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1))
      var stemp = extractedQuestions[si]
      extractedQuestions[si] = extractedQuestions[sj]
      extractedQuestions[sj] = stemp
    }

    // Shuffle options and update correct index
    extractedQuestions = extractedQuestions.map(function(q) {
      var correctText = q.options[q.correct]
      var shuffled = q.options.slice()
      for (var oi = shuffled.length - 1; oi > 0; oi--) {
        var oj = Math.floor(Math.random() * (oi + 1))
        var otemp = shuffled[oi]
        shuffled[oi] = shuffled[oj]
        shuffled[oj] = otemp
      }
      var newCorrect = shuffled.indexOf(correctText)
      return { question: q.question, options: shuffled, correct: newCorrect }
    })

    // Convert to DB format
    var dbQuestions = extractedQuestions.map(function(q) {
      if (type === 'exam') {
        return {
          q: q.question,
          options: q.options,
          correct: q.correct,
          points: Math.max(1, Math.floor(100 / extractedQuestions.length))
        }
      }
      return {
        question: q.question,
        options: q.options,
        correct: q.correct
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
            content: extractedQuestions.length + ' questions extracted by AI',
            questions: questionsStr,
            passScore: 50
          }
        })
      })
    } else {
      savedItem = await safeWrite(function() {
        return db.homework.create({
          data: {
            title: title.trim(),
            grade: grade,
            content: extractedQuestions.length + ' questions extracted by AI',
            questions: questionsStr
          }
        })
      })
    }

    console.log('Saved:', extractedQuestions.length, 'questions as', type)
    return NextResponse.json({
      success: true,
      message: 'Saved ' + extractedQuestions.length + ' questions successfully!',
      saved: savedItem,
      totalSaved: extractedQuestions.length
    })

  } catch (error) {
    console.error('Save error:', error)
    return NextResponse.json({ error: 'Save failed: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
