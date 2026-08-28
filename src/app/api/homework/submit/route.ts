// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    var body = await request.json()
    var studentId = body.studentId
    var homeworkId = body.homeworkId
    var answers = body.answers

    if (!studentId || !homeworkId) {
      return NextResponse.json({ error: 'studentId and homeworkId required' }, { status: 400 })
    }

    var homework = await db.homework.findUnique({ where: { id: homeworkId } })
    if (!homework) return NextResponse.json({ error: 'Homework not found' }, { status: 404 })

    // Grade on server
    var score = 0
    var maxScore = 100
    var details: { question: string; correct: boolean; studentAnswer: string; correctAnswer: string }[] = []

    if (homework.questions) {
      try {
        var questions = JSON.parse(homework.questions)
        var totalQ = questions.length
        if (totalQ > 0) {
          maxScore = totalQ
          for (var idx = 0; idx < questions.length; idx++) {
            var q = questions[idx]
            var selectedAnswer = answers[String(idx)] !== undefined ? answers[String(idx)] : answers[idx]
            var isCorrect = selectedAnswer === q.correct
            if (isCorrect) score++
            var questionText = q.question || q.q || ''
            var studentAns = q.options && q.options[selectedAnswer] ? q.options[selectedAnswer] : ''
            var correctAns = q.options && q.options[q.correct] ? q.options[q.correct] : ''
            details.push({
              question: questionText,
              correct: isCorrect,
              studentAnswer: String(studentAns),
              correctAnswer: String(correctAns),
            })
          }
        }
      } catch { /* invalid JSON, score stays 0 */ }
    }

    // Log activity
    safeWrite(function() {
      return db.studentActivity.create({
        data: {
          studentId: studentId,
          action: 'homework_submit',
          details: 'قدم واجب "' + homework.title + '" - الدرجة: ' + score + '/' + maxScore,
        },
      })
    }).catch(function() {})

    return NextResponse.json({
      success: true,
      result: { score: score, maxScore: maxScore, submittedAt: new Date().toISOString() },
      details: details,
    })
  } catch (error) {
    console.error('Homework submit error:', error)
    return NextResponse.json({ error: 'Failed to submit homework' }, { status: 500 })
  }
}
