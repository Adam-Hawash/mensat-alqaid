// @ts-nocheck
// POST /api/homework/grade-writing
// PURPOSE: Auto-grade writing/essay questions with SMART AI understanding:
//          the student answer is judged against the MODEL ANSWER
//          (الإجابة النموذجية) by MEANING + the FINAL answer — and every
//          graded answer gets a DEFINITE verdict (صح/غلط + درجة).
//          "يحتاج تصحيح يدوي" only when there is no model answer at all
//          or the AI itself is unavailable.
// Input: { studentId, homeworkId, writingAnswers: [{ question, answer, modelAnswer, acceptedAnswers, points }] }
// Output: { success, graded: [{ question, answer, modelAnswer, awardedPoints, maxPoints, isCorrect, feedback, gradingStatus }], totalAwarded, totalMax, aiUsed }

import { NextResponse } from 'next/server'
import { gradeWritingSmart } from '@/lib/smart-grader'

export const runtime = 'nodejs'
export const maxDuration = 180

export async function POST(request) {
  try {
    var body = await request.json()
    var writingAnswers = body.writingAnswers || []

    if (!writingAnswers || writingAnswers.length === 0) {
      return NextResponse.json({ success: true, graded: [], totalAwarded: 0, totalMax: 0 })
    }

    var totalMax = 0
    writingAnswers.forEach(function (wa) { totalMax += wa.points || 0 })

    var outcome = await gradeWritingSmart(writingAnswers)
    var graded = outcome.graded

    var totalAwarded = 0
    for (var i = 0; i < graded.length; i++) {
      totalAwarded += graded[i].awardedPoints || 0
    }

    return NextResponse.json({
      success: true,
      graded: graded,
      totalAwarded: totalAwarded,
      totalMax: totalMax,
      aiUsed: outcome.aiUsed,
    })
  } catch (error) {
    console.error('Grade writing error:', error)
    return NextResponse.json({ error: 'Error: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
