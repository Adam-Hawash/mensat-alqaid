// @ts-nocheck
// FILE: src/app/api/ai-extract-youtube/route.ts
// ROUTE: POST /api/ai-extract-youtube
// PURPOSE: Extract questions from YouTube video using Gemini native video
//          Returns questions ONLY (does NOT save to database)

import { NextResponse } from 'next/server'

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
  lines.push('You are an expert studies and history teacher. Watch this video carefully.')
  lines.push('')
  lines.push('CRITICAL RULES:')
  lines.push('- ONLY create questions based on what is actually taught/shown in this video')
  lines.push('- Do NOT add any topic, concept, or question that does not appear in the video')
  lines.push('- If the video covers exponents, ALL questions must be about exponents')
  lines.push('- If the video solves specific problems, create questions about those exact same types of problems')
  lines.push('- Use the same numbers, equations, and methods shown in the video')
  lines.push('')
  lines.push('Create exactly ' + numQuestions + ' MCQ questions from the video content:')
  lines.push('- Each question: exactly 4 options')
  lines.push('- correct = index (0, 1, 2, or 3)')
  lines.push('- ALL text in English')
  lines.push('- Write math using proper math symbols. Use Unicode superscripts for powers: x² for squared, x³ for cubed, x⁴ for to the power of 4. Use √ for square root, ∛ for cubic root. Use × for multiplication. Use ÷ for division. Do NOT write "squared", "cubed", "to the power of" as words. Do NOT use ^ or * symbols.')
  lines.push('- No repeated concepts')
  lines.push('- If the video shows solved examples, create similar questions with the same concept but different numbers')
  lines.push('')
  lines.push('JSON only:')
  lines.push('{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0}]}')
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

    var apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not found' }, { status: 500 })
    }

    var prompt = buildPrompt(numQuestions)
    var fullUrl = 'https://www.youtube.com/watch?v=' + videoId

    var requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { fileData: { fileUri: fullUrl, mimeType: 'video/mp4' } }
        ]
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
    }

    var models = ['gemini-3.6-flash', 'gemini-2.5-pro-preview-06-05', 'gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash']
    var geminiRes = null
    var lastError = ''

    for (var mi = 0; mi < models.length; mi++) {
      try {
        var modelUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + models[mi] + ':generateContent?key=' + apiKey
        console.log('Trying:', models[mi])
        geminiRes = await fetch(modelUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
        if (geminiRes.ok) {
          console.log('Success:', models[mi])
          break
        }
        var errBody = ''
        try { errBody = await geminiRes.text() } catch (e) {}
        lastError = models[mi] + ': ' + geminiRes.status
        console.error('Failed:', lastError)
      } catch (e) {
        lastError = models[mi] + ': ' + (e.message || '')
        console.error('Error:', lastError)
        geminiRes = null
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      return NextResponse.json({ error: 'AI error: ' + lastError }, { status: 500 })
    }

    var geminiData = await geminiRes.json()
    var text = ''
    try { text = geminiData.candidates[0].content.parts[0].text || '' } catch (e) {}

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
