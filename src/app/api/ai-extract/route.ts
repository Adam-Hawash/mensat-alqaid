// @ts-nocheck
// FILE: src/app/api/ai-extract/route.ts
// ROUTE: POST /api/ai-extract
// PURPOSE: Extract questions from uploaded file (PDF/image) or URL
//          Returns questions ONLY (does NOT save to database)

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request) {
  try {
    var formData = await request.formData()
    var file = formData.get('file')
    var fileUrl = formData.get('fileUrl') || ''
    var type = formData.get('type') || 'exam'
    var grade = formData.get('grade') || ''

    if ((!file || file.size === 0) && !fileUrl.trim()) {
      return NextResponse.json({ error: 'Upload a file or enter a URL' }, { status: 400 })
    }

    var apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not found' }, { status: 500 })
    }

    var base64Data = ''
    var mimeType = ''

    if (file && file.size > 0) {
      var bytes = new Uint8Array(await file.arrayBuffer())
      base64Data = Buffer.from(bytes).toString('base64')
      var fname = (file.name || '').toLowerCase()
      if (fname.endsWith('.pdf')) { mimeType = 'application/pdf' }
      else if (fname.endsWith('.png')) { mimeType = 'image/png' }
      else if (fname.endsWith('.webp')) { mimeType = 'image/webp' }
      else { mimeType = file.type || 'image/jpeg' }
    } else if (fileUrl.trim()) {
      try {
        var fetchRes = await fetch(fileUrl.trim())
        if (!fetchRes.ok) throw new Error('Download failed: ' + fetchRes.status)
        var arrayBuf = await fetchRes.arrayBuffer()
        base64Data = Buffer.from(new Uint8Array(arrayBuf)).toString('base64')
        var ct = fetchRes.headers.get('content-type') || ''
        if (ct.includes('pdf')) { mimeType = 'application/pdf' }
        else if (ct.includes('png')) { mimeType = 'image/png' }
        else if (ct.includes('webp')) { mimeType = 'image/webp' }
        else if (ct.includes('image')) { mimeType = ct }
        else { mimeType = 'image/jpeg' }
      } catch (err) {
        return NextResponse.json({ error: 'Failed to download file' }, { status: 400 })
      }
    }

    if (!base64Data) {
      return NextResponse.json({ error: 'No file data' }, { status: 400 })
    }

    var lines = []
    lines.push('You are an expert studies and history teacher. I will give you a document/image containing questions.')
    lines.push('IMPORTANT: Extract ONLY the questions that actually exist in this document. Do NOT invent, create, or add any questions that are not in the document.')
    lines.push('If the document has 5 questions, extract exactly those 5. If it has 20, extract all 20.')
    lines.push('For each question:')
    lines.push('- Copy the EXACT question text from the document (translate to English if needed)')
    lines.push('- Copy the EXACT options from the document (translate to English if needed)')
    lines.push('- If the document has fewer than 4 options, add plausible wrong options')
    lines.push('- If the document has no options, create 4 options with the correct answer included')
    lines.push('- Correct answer index (0=A, 1=B, 2=C, 3=D)')
    lines.push('')
    lines.push('Rules:')
    lines.push('- ALL output text in English')
    lines.push('- Write math using proper math symbols. Use Unicode superscripts for powers: x² for squared, x³ for cubed, x⁴ for to the power of 4. Use √ for square root, ∛ for cubic root. Use × for multiplication. Use ÷ for division. Do NOT write "squared", "cubed", "to the power of" as words. Do NOT use ^ or * symbols.')
    lines.push('- Do NOT add questions from outside the document')
    lines.push('- Do NOT skip any question from the document')
    lines.push('- Grade: ' + grade + ' | Type: ' + type)
    lines.push('')
    lines.push('JSON only:')
    lines.push('{"title":"...","content":"...","questions":[{"question":"...","options":["A","B","C","D"],"correct":0,"points":1}],"answerKey":""}')
    var prompt = lines.join('\n')

    var parts = [{ text: prompt }]
    parts.push({ inlineData: { mimeType: mimeType, data: base64Data } })

    var models = ['gemini-3.6-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash']
    var geminiRes = null
    var lastError = ''

    for (var mi = 0; mi < models.length; mi++) {
      try {
        var modelUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + models[mi] + ':generateContent?key=' + apiKey
        geminiRes = await fetch(modelUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
          })
        })
        if (geminiRes.ok) { break }
        var errBody = ''
        try { errBody = await geminiRes.text() } catch (e) {}
        lastError = models[mi] + ': ' + geminiRes.status
        console.error('Model failed:', lastError)
      } catch (e) {
        lastError = models[mi] + ': ' + (e.message || '')
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

    var extracted = JSON.parse(jsonMatch[0])
    if (!extracted.title) { extracted.title = type + ' - ' + grade }
    if (!extracted.content) { extracted.content = '' }
    if (!Array.isArray(extracted.questions)) { extracted.questions = [] }
    if (!extracted.answerKey) { extracted.answerKey = '' }

    extracted.questions = extracted.questions.map(function(q) {
      return {
        question: q.question || '',
        options: (q.options || ['N/A', 'N/A', 'N/A', 'N/A']).slice(0, 4),
        correct: typeof q.correct === 'number' ? q.correct : 0,
        points: q.points || 1
      }
    })

    return NextResponse.json({ success: true, extracted: extracted })
  } catch (error) {
    console.error('AI extract error:', error)
    return NextResponse.json({ error: 'Error: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
