// @ts-nocheck
// FILE: src/app/api/ai-extract-youtube/route.ts
// ROUTE: POST /api/ai-extract-youtube
// PURPOSE: Extract questions from YouTube video using Gemini native video
//          Returns questions ONLY (does NOT save to database)
//          (منصة القائد — الدراسات الاجتماعية والتاريخ: أسئلة بالعربي من
//           محتوى الفيديو نفسه، عبر مساعد Gemini المركزي مع تداول المفاتيح)

import { NextResponse } from 'next/server'
import { callGemini as callGeminiCentral, hasGeminiKey } from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 300

function extractYouTubeId(url) {
  if (!url) return null
  var m1 = url.match(/youtu\.be\/([\w-]{11})/) ; if (m1) return m1[1]
  var m2 = url.match(/youtube\.com\/watch\?v=([\w-]{11})/) ; if (m2) return m2[1]
  var m3 = url.match(/youtube\.com\/embed\/([\w-]{11})/) ; if (m3) return m3[1]
  var m4 = url.match(/youtube\.com\/shorts\/([\w-]{11})/) ; if (m4) return m4[1]
  var m5 = url.match(/youtube\.com\/live\/([\w-]{11})/) ; if (m5) return m5[1]
  var m6 = url.match(/youtube\.com\/v\/([\w-]{11})/) ; if (m6) return m6[1]
  var m7 = url.match(/youtube\.com\/([\w-]{11})(?:[?\/]|$)/) ; if (m7) return m7[1]
  return null
}

function buildPrompt(numQuestions) {
  var lines = []
  lines.push('أنت معلم خبير في الدراسات الاجتماعية والتاريخ للمنهج المصري. شوف الفيديو ده كويس.')
  lines.push('')
  lines.push('قواعد صارمة:')
  lines.push('- اعمل أسئلة من اللي اتشرح فعلاً في الفيديو فقط')
  lines.push('- ممنوع تضيف أي موضوع أو معلومة أو سؤال مش موجود في الفيديو')
  lines.push('- لو الفيديو بيشرح درس معين، كل الأسئلة لازم تكون عن نفس الدرس')
  lines.push('- استخدم نفس الأسماء والتواريخ والأماكن والمصطلحات اللي في الفيديو')
  lines.push('')
  lines.push('اعمل بالظبط ' + numQuestions + ' سؤال اختياري من محتوى الفيديو:')
  lines.push('- كل سؤال له 4 اختيارات بالظبط')
  lines.push('- correct = رقم الإجابة الصحيحة (0, 1, 2, أو 3)')
  lines.push('- كل الأسئلة والاختيارات بالعربي (نفس لغة الفيديو)')
  lines.push('- ممنوع تكرار نفس الفكرة في أكتر من سؤال')
  lines.push('- لو الفيديو فيه أمثلة محلولة، اعمل أسئلة مشابهة بنفس الفكرة')
  lines.push('')
  lines.push('JSON فقط:')
  lines.push('{"questions": [{"question": "...", "options": ["أ", "ب", "ج", "د"], "correct": 0}]}')
  return lines.join('\n')
}

export async function POST(request) {
  try {
    var body = await request.json()
    var youtubeUrl = body.youtubeUrl || ''
    var numQuestions = parseInt(body.numQuestions) || 10

    if (!youtubeUrl.trim()) {
      return NextResponse.json({ error: 'Enter a YouTube URL' }, { status: 400 })
    }

    var videoId = extractYouTubeId(youtubeUrl)
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
    }

    console.log('Video ID:', videoId)

    if (!hasGeminiKey()) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not found' }, { status: 500 })
    }

    var prompt = buildPrompt(numQuestions)
    var fullUrl = 'https://www.youtube.com/watch?v=' + videoId

    var parts = [
      { text: prompt },
      { fileData: { fileUri: fullUrl, mimeType: 'video/mp4' } },
    ]

    console.log('[YouTube Extract] Calling Gemini (studies, central helper)')
    var result = await callGeminiCentral({
      parts: parts,
      generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
      timeoutMs: 120000,
    })

    if (!result.ok) {
      return NextResponse.json({ error: 'AI error: ' + (result.error || 'unknown') }, { status: 500 })
    }

    var text = result.text || ''

    if (!text.trim()) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    var jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    var parsed = JSON.parse(jsonMatch[0])
    var questions = (parsed.questions || []).map(function(q) {
      var opts = Array.isArray(q.options) ? q.options.slice() : ['N/A', 'N/A', 'N/A', 'N/A']
      while (opts.length < 4) { opts.push('N/A') }
      var c = typeof q.correct === 'number' ? q.correct : 0
      if (c < 0 || c > 3) { c = 0 }
      return { question: q.question || '', options: opts.slice(0, 4), correct: c }
    }).filter(function(q) { return q.question.trim().length > 0 })

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No questions extracted. Try a educational video.' }, { status: 400 })
    }

    console.log('Extracted:', questions.length, 'questions')
    return NextResponse.json({
      success: true,
      extracted: {
        questions: questions,
        title: '',
        content: 'Extracted from YouTube (' + questions.length + ' questions)',
        answerKey: ''
      }
    })
  } catch (error) {
    console.error('YouTube error:', error)
    return NextResponse.json({ error: 'Error: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
