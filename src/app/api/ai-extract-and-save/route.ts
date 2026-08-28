// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    var formData = await request.formData()
    var file = formData.get('file') as File | null
    var fileUrl = formData.get('fileUrl') as string | null
    var type = formData.get('type') as string || 'exam' // 'exam' or 'homework'
    var grade = formData.get('grade') as string || ''
    var title = formData.get('title') as string || ''
    var questionsJson = formData.get('questions') as string || ''

    // Validate required fields
    if (!grade) {
      return NextResponse.json({ error: 'الرجاء اختيار الصف' }, { status: 400 })
    }
    if (!title.trim()) {
      return NextResponse.json({ error: 'الرجاء إدخال العنوان' }, { status: 400 })
    }

    // If questions already provided (user edited them), skip AI extraction
    var extractedQuestions = []
    if (questionsJson) {
      try {
        extractedQuestions = JSON.parse(questionsJson)
      } catch (e) {
        return NextResponse.json({ error: 'صيغة الأسئلة غير صحيحة' }, { status: 400 })
      }
    }

    // If no pre-provided questions, extract via AI
    if (extractedQuestions.length === 0 && (file || fileUrl)) {
      var imageBase64 = ''
      var mimeType = ''

      if (file) {
        var bytes = await file.arrayBuffer()
        var buffer = Buffer.from(bytes)
        imageBase64 = buffer.toString('base64')
        mimeType = file.type || 'application/pdf'
      } else if (fileUrl) {
        try {
          var res = await fetch(fileUrl)
          if (!res.ok) {
            return NextResponse.json({ error: 'فشل جلب الملف من الرابط' }, { status: 400 })
          }
          var arrayBuf = await res.arrayBuffer()
          var buf = Buffer.from(arrayBuf)
          imageBase64 = buf.toString('base64')
          var contentType = res.headers.get('content-type') || ''
          mimeType = contentType || 'application/pdf'
        } catch (fetchErr) {
          return NextResponse.json({ error: 'فشل جلب الملف: ' + (fetchErr.message || '') }, { status: 400 })
        }
      }

      var apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'مفتاح GEMINI_API_KEY غير مضبوط في الإعدادات' }, { status: 500 })
      }

      var prompt = 'أنت معلم دراسات وتاريخ خبير. استخرج كل الأسئلة من هذه الصفحة/الصورة. لكل سؤال اكتب: رقم السؤال، نص السؤال كاملاً، الإجابة الصحيحة، و4 اختيارات (إذا كان سؤال اختيار من متعدد) أو "لا يوجد" إذا كان سؤال حر. رد بـ JSON فقط بدون أي نص إضافي بهذا الشكل بالضبط: {"questions": [{"question": "نص السؤال", "options": ["اختيار1", "اختيار2", "اختيار3", "اختيار4"], "correct": 0}]} ملاحظات: correct = index الاختيار الصحيح (0-3)، إذا السؤال حر حط options كلها "لا يوجد" و correct = 0، لو فيها معادلات اكتبها بالعادي، استخرج كل الأسئلة الموجودة.'

      var body = {
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType, data: imageBase64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
      }

      var models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.0-flash', 'gemini-2.5-flash-preview-05-20']
      var geminiResponse = null
      var lastError = ''

      for (var mi = 0; mi < models.length; mi++) {
        try {
          var geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + models[mi] + ':generateContent?key=' + apiKey
          geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (geminiResponse.ok) break
          lastError = 'Model ' + models[mi] + ' returned ' + geminiResponse.status
          console.error(lastError)
        } catch (e: any) {
          lastError = 'Model ' + models[mi] + ' error: ' + (e.message || '')
          console.error(lastError)
          geminiResponse = null
        }
      }

      if (!geminiResponse || !geminiResponse.ok) {
        return NextResponse.json({ error: 'خطأ في خدمة الذكاء الاصطناعي: جميع النماذج فشلت. ' + lastError }, { status: 500 })
      }

      var geminiData = await geminiResponse.json()
      var text = geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content && geminiData.candidates[0].content.parts && geminiData.candidates[0].content.parts[0] && geminiData.candidates[0].content.parts[0].text

      if (!text) {
        return NextResponse.json({ error: 'لم يرد الذكاء الاصطناعي بأي نتيجة' }, { status: 500 })
      }

      var jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({ error: 'لم يتم تحليل رد الذكاء الاصطناعي' }, { status: 500 })
      }

      try {
        var parsed = JSON.parse(jsonMatch[0])
      } catch (parseErr) {
        return NextResponse.json({ error: 'صيغة JSON غير صحيحة من الذكاء الاصطناعي' }, { status: 500 })
      }

      var questions = parsed.questions || []
      extractedQuestions = questions.map(function(q) {
        var opts = Array.isArray(q.options) ? q.options : ['لا يوجد', 'لا يوجد', 'لا يوجد', 'لا يوجد']
        while (opts.length < 4) opts.push('لا يوجد')
        var correct = typeof q.correct === 'number' ? q.correct : 0
        if (correct < 0 || correct > 3) correct = 0
        return { question: q.question || '', options: opts.slice(0, 4), correct: correct }
      }).filter(function(q) { return q.question.trim().length > 0 })
    }

    if (extractedQuestions.length === 0) {
      return NextResponse.json({ error: 'لم يتم استخراج أي أسئلة. تأكد أن الملف يحتوي على أسئلة واضحة.' }, { status: 400 })
    }

    // ===== Shuffle questions and options =====
    // Shuffle question order
    for (var si = extractedQuestions.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1))
      var stemp = extractedQuestions[si]
      extractedQuestions[si] = extractedQuestions[sj]
      extractedQuestions[sj] = stemp
    }
    // Shuffle options for each question and update correct index
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

    // Convert to the format stored in DB (MCQ format for Exam/Homework)
    // Homework uses: { question, options, correct }
    // Exam uses: { q, options, correct, points }
    var dbQuestions = extractedQuestions.map(function(q, i) {
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

    // Save to database
    var savedItem = null
    var questionsStr = JSON.stringify(dbQuestions)

    if (type === 'exam') {
      savedItem = await safeWrite(function() {
        return db.exam.create({
          data: {
            title: title.trim(),
            grade: grade,
            content: extractedQuestions.length + ' سؤال مستخرج بالذكاء الاصطناعي',
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
            content: extractedQuestions.length + ' سؤال مستخرج بالذكاء الاصطناعي',
            questions: questionsStr
          }
        })
      })
    }

    return NextResponse.json({
      success: true,
      message: 'تم استخراج ' + extractedQuestions.length + ' سؤال وحفظهم بنجاح!',
      questions: extractedQuestions,
      saved: savedItem,
      totalExtracted: extractedQuestions.length
    })

  } catch (error) {
    console.error('Extract and save error:', error)
    return NextResponse.json({ error: 'فشل الاستخراج: ' + (error.message || 'خطأ غير معروف') }, { status: 500 })
  }
}
