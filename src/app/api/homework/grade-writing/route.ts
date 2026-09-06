// @ts-nocheck
// POST /api/homework/grade-writing
// PURPOSE: Auto-grade writing/essay questions using AI based on modelAnswer
// (منصة القائد — الدراسات الاجتماعية والتاريخ. The grader UNDERSTANDS the
//  question and compares by MEANING + key facts, not literal string match.)
// Input: { studentId, homeworkId, writingAnswers: [{ question, answer, modelAnswer, acceptedAnswers, points }] }
// Output: { graded: [{ question, answer, modelAnswer, awardedPoints, maxPoints, isCorrect, feedback }] }

import { NextResponse } from 'next/server'
import { callGemini as callGeminiCentral, hasGeminiKey } from '@/lib/gemini'
import { parseAiJson } from '@/lib/parse-ai-json'

export const runtime = 'nodejs'
export const maxDuration = 180

interface WritingAnswer {
  question: string
  answer: string
  modelAnswer?: string
  acceptedAnswers?: string[]
  points: number
}

interface GradedAnswer {
  question: string
  answer: string
  modelAnswer: string
  awardedPoints: number
  maxPoints: number
  isCorrect: boolean
  feedback: string
}

// Quick check: if student answer matches acceptedAnswers directly (case-insensitive, trimmed)
function quickMatch(studentAnswer: string, acceptedAnswers: string[]): boolean {
  if (!studentAnswer || !acceptedAnswers || acceptedAnswers.length === 0) return false
  var cleaned = studentAnswer.trim().toLowerCase().replace(/\s+/g, ' ')
  for (var i = 0; i < acceptedAnswers.length; i++) {
    var acc = (acceptedAnswers[i] || '').trim().toLowerCase().replace(/\s+/g, ' ')
    if (acc && (cleaned === acc || cleaned.includes(acc))) {
      return true
    }
  }
  return false
}

export async function POST(request) {
  try {
    var body = await request.json()
    var writingAnswers: WritingAnswer[] = body.writingAnswers || []
    var studentId = body.studentId
    var homeworkId = body.homeworkId

    if (!writingAnswers || writingAnswers.length === 0) {
      return NextResponse.json({ success: true, graded: [], totalAwarded: 0, totalMax: 0 })
    }

    var hasKey = hasGeminiKey()
    var graded: GradedAnswer[] = []
    var totalAwarded = 0
    var totalMax = 0

    // First pass: quick accept if exact match with acceptedAnswers
    var needAI: WritingAnswer[] = []
    for (var i = 0; i < writingAnswers.length; i++) {
      var wa = writingAnswers[i]
      totalMax += wa.points || 0

      // If student answer is empty, give 0 and mark as not answered
      if (!wa.answer || wa.answer.trim() === '' || wa.answer.trim() === '[📷 صورة مرفقة]') {
        graded[i] = {
          question: wa.question,
          answer: wa.answer || '',
          modelAnswer: wa.modelAnswer || '',
          awardedPoints: 0,
          maxPoints: wa.points || 0,
          isCorrect: false,
          feedback: 'Not answered'
        }
        continue
      }

      // Quick check against acceptedAnswers
      if (wa.acceptedAnswers && wa.acceptedAnswers.length > 0 && quickMatch(wa.answer, wa.acceptedAnswers)) {
        graded[i] = {
          question: wa.question,
          answer: wa.answer,
          modelAnswer: wa.modelAnswer || '',
          awardedPoints: wa.points || 0,
          maxPoints: wa.points || 0,
          isCorrect: true,
          feedback: 'الإجابة صحيحة ✓ (تطابقت مع الإجابات المقبولة)'
        }
        totalAwarded += wa.points || 0
        continue
      }

      // If no modelAnswer, can't grade — needs manual
      if (!wa.modelAnswer) {
        graded[i] = {
          question: wa.question,
          answer: wa.answer,
          modelAnswer: '',
          awardedPoints: 0,
          maxPoints: wa.points || 0,
          isCorrect: false,
          feedback: 'لا توجد إجابة نموذجية للتصحيح — يحتاج تصحيح يدوي'
        }
        continue
      }

      needAI.push(wa)
      // Placeholder until AI grades it
      graded[i] = {
        question: wa.question,
        answer: wa.answer,
        modelAnswer: wa.modelAnswer,
        awardedPoints: 0,
        maxPoints: wa.points || 0,
        isCorrect: false,
        feedback: 'بانتظار التصحيح بالـ AI...'
      }
    }

    // If AI not configured, return quick-graded results
    if (!hasKey || needAI.length === 0) {
      // Recalculate total
      var recalculatedTotal = 0
      for (var k = 0; k < graded.length; k++) { recalculatedTotal += graded[k].awardedPoints }
      return NextResponse.json({
        success: true,
        graded: graded,
        totalAwarded: recalculatedTotal,
        totalMax: totalMax,
        aiUsed: false,
        message: needAI.length === 0 ? 'تم التصحيح السريع' : 'AI غير متاح - تم استخدام التصحيح السريع فقط'
      })
    }

    // ============= AI Grading (studies & history — understand the answer) =============
    var lines = []
    lines.push('أنت معلم خبير صارم في الدراسات الاجتماعية والتاريخ للمنهج المصري، بتصحح إجابات طلاب.')
    lines.push('لكل سؤال: افهم السؤال الأول (إيه المعلومة/الأسماء/التواريخ/الأسباب اللي السؤال عايزها)، وبعدين قارن إجابة الطالب بالإجابة النموذجية بالمعنى مش بالحرف.')
    lines.push('لو الطالب كتب المعلومة الصحيحة بكلامه هو → دي إجابة صحيحة. الترتيب المختلف أو الصياغة المختلفة مش غلط.')
    lines.push('التواريخ المكافئة صح: ١٩٥٢ = 1952 = 1952م. نفس الاسم بطرق كتابة مختلفة = صح.')
    lines.push('الدرجة بتتحدد بالنقاط الأساسية اللي السؤال طالبها: كل نقطة أساسية صحيحة تاخد حصتها من الدرجة، والناقص أو الغلط ينقص بالتناسب.')
    lines.push('')
    lines.push('قواعد:')
    lines.push('- إجابة الطالب فاضية → صفر و isCorrect: false و feedback: "Not answered"')
    lines.push('- كل الإجابة صحيحة → الدرجة كاملة (isCorrect: true)')
    lines.push('- نقاط أساسية ناقصة أو غلط → درجة جزئية بالتناسب')
    lines.push('- إجابة غير مرتبطة بالسؤال خالص → صفر')
    lines.push('- قرّب الدرجة لأقرب عدد صحيح (0 إلى maxPoints)')
    lines.push('- اكتب تعليق قصير بالعامية المصرية يوضح الدرجة')
    lines.push('')
    lines.push('ارجع JSON array ONLY بالشكل ده بالظبط:')
    lines.push('[{"index":0,"awardedPoints":5,"isCorrect":true,"feedback":"تعليق قصير بالعامية"},...]')
    lines.push('الـ index لازم يطابق رقم السؤال في القايمة.')
    lines.push('')
    lines.push('الأسئلة المطلوب تصحيحها:')

    needAI.forEach(function(wa, idx) {
      lines.push('--- السؤال ' + idx + ' (الدرجة القصوى ' + (wa.points || 0) + ') ---')
      lines.push('السؤال: ' + wa.question)
      lines.push('إجابة الطالب: ' + wa.answer)
      lines.push('الإجابة النموذجية: ' + (wa.modelAnswer || '(none)'))
      if (wa.acceptedAnswers && wa.acceptedAnswers.length > 0) {
        lines.push('إجابات مقبولة كمان: ' + wa.acceptedAnswers.join(' | '))
      }
      lines.push('')
    })

    var prompt = lines.join('\n')
    var parts = [{ text: prompt }]

    // Central helper: Gemini 3.6 first + automatic key rotation on quota (429)
    console.log('[Grade Writing] Calling Gemini (studies grading)')
    var result = await callGeminiCentral({
      parts: parts,
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      timeoutMs: 60000,
    })

    if (!result.ok) {
      var lastError = result.error || 'unknown'
      // AI failed - return quick-graded results with note
      var quickTotal = 0
      for (var j = 0; j < graded.length; j++) { quickTotal += graded[j].awardedPoints }
      return NextResponse.json({
        success: true,
        graded: graded,
        totalAwarded: quickTotal,
        totalMax: totalMax,
        aiUsed: false,
        message: 'فشل التصحيح بالـ AI - يحتاج تصحيح يدوي: ' + lastError
      })
    }

    var text = result.text || ''

    // Parse JSON array from response
    var jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      try {
        var aiResults = parseAiJson(jsonMatch[0])
        if (Array.isArray(aiResults)) {
          // Apply AI results back to graded array
          needAI.forEach(function(wa, idx) {
            // Find original index in graded array
            var origIdx = -1
            for (var x = 0; x < graded.length; x++) {
              if (graded[x].question === wa.question && graded[x].answer === wa.answer) {
                origIdx = x
                break
              }
            }
            if (origIdx === -1) return

            // Find matching AI result
            var aiRes = aiResults.find(function(r) { return r.index === idx })
            if (aiRes) {
              var awarded = Math.min(Math.max(Math.round(aiRes.awardedPoints || 0), 0), wa.points || 0)
              graded[origIdx].awardedPoints = awarded
              graded[origIdx].isCorrect = awarded >= (wa.points * 0.5)
              graded[origIdx].feedback = aiRes.feedback || (aiRes.isCorrect ? 'صحيح' : 'غير صحيح')
              totalAwarded += awarded
            }
          })
        }
      } catch (parseErr) {
        console.error('AI grade parse error:', parseErr)
      }
    }

    // Recalculate total
    var finalTotal = 0
    for (var f = 0; f < graded.length; f++) { finalTotal += graded[f].awardedPoints }

    return NextResponse.json({
      success: true,
      graded: graded,
      totalAwarded: finalTotal,
      totalMax: totalMax,
      aiUsed: true
    })
  } catch (error) {
    console.error('Grade writing error:', error)
    return NextResponse.json({ error: 'Error: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
