// @ts-nocheck
import { parseAiJson } from '@/lib/parse-ai-json'
// FILE: src/app/api/ai/extract-questions/route.ts
// ROUTE: POST /api/ai/extract-questions
// PURPOSE: SMART extraction of questions from uploaded file (PDF/image) or URL
//          for منصة القائد (الدراسات الاجتماعية والتاريخ — مستر عمرو رشدي).
//          Returns questions ONLY (does NOT save to database).
//
// SMART EXTRACTION RULES (مطابق لما اتعمل في Maths Genius لكن للدراسات):
//  - Extracts ONLY the questions that actually exist in the document.
//  - Questions stay in the ORIGINAL language (Arabic stays Arabic — no
//    forced English translation; this is a studies platform).
//  - Detects question TYPE: اختياري (MCQ with options) or مقالي (essay /
//    short answer → type:'writing' + a model answer built from the document).
//  - Uses the central Gemini helper: Gemini 3.6 first, multi-key rotation
//    on 429, thinking config + empty-response auto-retry.

import { NextResponse } from 'next/server'
import { callGemini as callGeminiCentral, hasGeminiKey } from '@/lib/gemini'

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
      return NextResponse.json({ error: 'ارفع ملف أو حط رابط' }, { status: 400 })
    }

    if (!hasGeminiKey()) {
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
        return NextResponse.json({ error: 'فشل تحميل الملف من الرابط' }, { status: 400 })
      }
    }

    if (!base64Data) {
      return NextResponse.json({ error: 'No file data' }, { status: 400 })
    }

    var lines = []
    lines.push('أنت معلم خبير في الدراسات الاجتماعية والتاريخ للمنهج المصري. سأعطيك مستند/صورة فيها أسئلة.')
    lines.push('مهم جداً: استخرج الأسئلة الموجودة في المستند فقط. ممنوع تخترع أو تضيف أي سؤال مش موجود في المستند. لو المستند فيه 5 أسئلة استخرج خمسة بالظبط، ولو فيه 20 استخرج العشرين كلها.')
    lines.push('لكل سؤال:')
    lines.push('- انقل نص السؤال بنفسه بالظبط زي ما هو مكتوب (باللغة الأصلية — العربي يفضل عربي من غير ترجمة).')
    lines.push('- حدد نوع السؤال: لو له اختيارات يكون type "mcq" مع الخيارات، ولو سؤال مقالي أو سؤال short answer أو اكمل أو علل يكون type "writing" من غير خيارات.')
    lines.push('- للسؤال المقالي (writing): اكتب إجابة نموذجية مختصرة وصحيحة في modelAnswer مبنية على محتوى المستند نفسه.')
    lines.push('- للسؤال الاختياري (mcq): انقل الخيارات الأربعة بنفسها بالظبط، وحدد رقم الإجابة الصحيحة correct (0=A, 1=B, 2=C, 3=D). لو الخيارات أقل من أربعة كمّلها لاختيارات غلط منطقية. لو مفيش خيارات في المستند اعمل 4 خيارات من ضمنهم الصحيح.')
    lines.push('- حدد درجة السؤال points: الاختياري عادة 1، المقالي عادة 5.')
    lines.push('')
    lines.push('قواعد صارمة:')
    lines.push('- كل النصوص تطلع بنفس لغة المستند الأصلية (عربي يفضل عربي).')
    lines.push('- ممنوع تضيف أسئلة من بره المستند.')
    lines.push('- ممنوع تتخطى أي سؤال موجود في المستند.')
    lines.push('- التواريخ والأسماء والأماكن تتكتب زي ما هي بالظبط.')
    lines.push('- الصف: ' + grade + ' | النوع: ' + type)
    lines.push('')
    lines.push('JSON فقط من غير أي كلام زائد:')
    lines.push('{"title":"...","questions":[{"type":"mcq","question":"...","options":["أ","ب","ج","د"],"correct":0,"points":1},{"type":"writing","question":"...","options":[],"correct":-1,"points":5,"modelAnswer":"..."}],"answerKey":""}')
    var prompt = lines.join('\n')

    var parts = [{ text: prompt }]
    parts.push({ inlineData: { mimeType: mimeType, data: base64Data } })

    // Central helper: Gemini 3.6 first + automatic key rotation on quota (429)
    console.log('[Extract Questions] Calling Gemini (studies smart extraction)')
    var result = await callGeminiCentral({
      parts: parts,
      generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
      timeoutMs: 90000,
    })

    if (!result.ok) {
      console.error('[Extract Questions] All models failed:', result.error)
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

    var parsed = parseAiJson(text)
    if (!parsed) {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }
    var questions = (parsed.questions || []).map(function(q) {
      var qText = q.question || q.q || ''
      var isWriting = q.type === 'writing' || q.type === 'essay'
      if (!isWriting && (!Array.isArray(q.options) || q.options.length === 0)) isWriting = true
      if (isWriting) {
        return {
          type: 'writing',
          question: qText,
          options: [],
          correct: -1,
          points: (typeof q.points === 'number' && q.points > 0) ? q.points : 5,
          modelAnswer: q.modelAnswer || q.answer || '',
        }
      }
      var opts = Array.isArray(q.options) ? q.options.slice() : ['N/A', 'N/A', 'N/A', 'N/A']
      while (opts.length < 4) { opts.push('N/A') }
      var c = typeof q.correct === 'number' ? q.correct : 0
      if (c < 0 || c > 3) { c = 0 }
      return {
        type: 'mcq',
        question: qText,
        options: opts.slice(0, 4),
        correct: c,
        points: (typeof q.points === 'number' && q.points > 0) ? q.points : 1,
        modelAnswer: q.modelAnswer || '',
      }
    }).filter(function(q) { return q.question.trim().length > 0 })

    if (questions.length === 0) {
      return NextResponse.json({ error: 'مفيش أسئلة اتستخرجت من الملف.' }, { status: 400 })
    }

    var stats = { mcq: 0, writing: 0 }
    questions.forEach(function(q) { if (q.type === 'writing') stats.writing++; else stats.mcq++ })

    return NextResponse.json({ success: true, extracted: { title: parsed.title || '', content: parsed.content || '', questions: questions, answerKey: parsed.answerKey || '', stats: stats } })
  } catch (error) {
    console.error('Extract questions error:', error)
    return NextResponse.json({ error: 'Error: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
