// @ts-nocheck
// Shared AI grading logic — used by /api/ai/grade-image (direct) and
// /api/homework/submit + /api/exams/submit (in-process) to avoid localhost fetch.
//
// ADAPTED FOR منصة القائد (الدراسات الاجتماعية والتاريخ — مستر عمرو رشدي):
//  - The grader is a STRICT studies & history teacher (not math).
//  - It must UNDERSTAND the question and the student's answer semantically —
//    grade by MEANING + the FINAL answer against the الإجابة النموذجية,
//    never by literal string matching (كلام المستر: "يشوف فين الإجابة
//    النهائية ويصحح بناءً على الإجابة النهائية وخطوات الحل").
//  - Final-answer equivalence (dates, numbers, name spelling variants)
//    still applies as a local safety net for AI false-negatives.
//
// DESIGN GOALS (same as Maths-Genius — Task 18 fix):
//  1. FAST  — thinking:'low', tight output tokens, callGrader with TWO
//             automatic attempts + 35s timeout (a transient failure should
//             NEVER leave a submission stuck on "needs manual correction").
//  2. SMART — the model must FIRST verify the photo actually contains the
//             STUDENT'S OWN answer to THIS question (onTopic check) before
//             grading. Reading the printed question as "the answer" was the
//             #1 accuracy bug. Then find the FINAL ANSWER and judge it.
//  3. FAIR  — the AI verdict stands; the only local override is an EXACT
//             normalized final-answer equivalence.
//  4. HONEST/DECISIVE — low-confidence and onTopic=false produce a DEFINITE
//             verdict (صح/غلط) instead of stalling on "يحتاج تصحيح يدوي".
//             needsGrading stays ONLY for genuinely gradeable-nothing cases:
//             no image/answer at all, no API key, or AI failed twice.

import { db } from '@/lib/db'
import { callGemini as callGeminiCentral, hasGeminiKey } from '@/lib/gemini'
import { repairModelJson, repairCorruptMath } from '@/lib/parse-ai-json'

// Grading calls: low thinking = much faster, output is small structured JSON.
// One automatic retry — a transient failure should NEVER leave a submission
// stuck on "needs manual correction" (teacher request: AI finishes the job).
/* 2026-و25 (نقل من maths-genius 25-a) — 3 محاولات بـ backoff صريح (1.5s ثم 4s)
   على 429/فشل: مفتاح Gemini الواحد المجاني بيضرب 429 بسهولة (خصوصًا مع تسلسل
   أسئلة مقالي كتير) — المحاولتين القديمين (1.2s بس) كانوا مش كفاية، وأول فشل
   كان بيسقط على فولباك الصفر. timeoutMs: 35s افتراضي للنص — الصور بتمرر 60s
   (صور الحل الكبيرة كانت بتقطع لو قللناه — درس 2026-و12). */
async function callGrader(parts: any[], timeoutMs?: number): Promise<{ ok: boolean; text?: string; error?: string }> {
  var lastErr = ''
  var backoffs = [1500, 4000]
  for (var attempt = 0; attempt < 3; attempt++) {
    var result = await callGeminiCentral({
      parts: parts,
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      timeoutMs: timeoutMs || 35000,
      thinking: 'low',
    })
    if (result.ok) return { ok: true, text: result.text }
    lastErr = result.error || 'unknown'
    if (attempt < 2) await new Promise(function (r) { setTimeout(r, backoffs[attempt]) })
  }
  return { ok: false, error: lastErr }
}

/* (2026-و25 — نقل 25-a) نداء التحقق الرخيص — STRICT VERIFY: بيقارن قيم/حقائق
   الإجابة النهائية بس. 2 محاولات بتايم أوت قصير (20s) — دي مكالمة صغيرة
   (رد JSON سطر واحد). */
async function callVerifier(parts: any[]): Promise<{ ok: boolean; text?: string; error?: string }> {
  var lastErr = ''
  for (var attempt = 0; attempt < 2; attempt++) {
    var result = await callGeminiCentral({
      parts: parts,
      generationConfig: { temperature: 0.0, maxOutputTokens: 1024 },
      timeoutMs: 20000,
      thinking: 'low',
    })
    if (result.ok) return { ok: true, text: result.text }
    lastErr = result.error || 'unknown'
    if (attempt === 0) await new Promise(function (r) { setTimeout(r, 1500) })
  }
  return { ok: false, error: lastErr }
}

function parseAIJson(text: string): any | null {
  if (!text || !text.trim()) return null
  var jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    return JSON.parse(repairModelJson(jsonMatch[0]))
  } catch (e) {
    return null
  }
}

/* ------------------------------------------------------------------
 * Strict final-answer normalization for equivalence checking.
 * Handles dates, numbers, Arabic/English name variants, unit symbols.
 * "٢٠١٣" === "2013", "1952م" === "1952", " محمد علي " === "محمد علي"
 * ------------------------------------------------------------------ */
export function normalizeFinalAnswer(s: string): string {
  var out = String(s || '').toLowerCase()
  // Arabic-Indic digits → Western digits
  var arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  out = out.replace(/[٠-٩]/g, function (d) { return String(arabicDigits.indexOf(d)) })
  out = out.replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)) })
  // Arabic decimal separator ٫ → .  , and "3,5" → "3.5" (decimal comma)
  out = out.replace(/٫/g, '.')
  out = out.replace(/(\d)\s*,\s*(\d)/g, '$1.$2')
  // unicode superscripts → ^digits (kept from math heritage, harmless)
  var supMap: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
  out = out.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, function (m) {
    var r = '^'
    for (var i = 0; i < m.length; i++) r += supMap[m[i]] || ''
    return r
  })
  // \frac{a}{b} → a/b  (handle nesting one level)
  for (var pass = 0; pass < 2; pass++) {
    out = out.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2')
  }
  // unify operators & strip noise characters
  out = out.replace(/[×·]/g, '*')
  out = out.replace(/÷/g, '/')
  out = out.replace(/[\s{}$]/g, '')
  out = out.replace(/\\left|\\right/g, '')
  out = out.replace(/\\/g, '')
  // aaaa… (letter run of 3+) → a^n so "aaaaaaa" === "a^7"
  out = out.replace(/([a-z])\1{2,}/g, function (m, ch) { return ch + '^' + m.length })
  // strip common Arabic era/punctuation decorations after dates
  out = out.replace(/[مًm]+$/g, '')
  out = out.replace(/[.,;:،؛]+$/, '')
  return out
}

/* pull the final answer (after the last '=') from a solution text */
function finalPart(s: string): string {
  var parts = String(s || '').split('=')
  return (parts[parts.length - 1] || '').trim()
}

/* canonicalize a pure monomial so x^6y^4 === y^4*x^6 (order never matters).
 * Returns '' for anything that is NOT a pure monomial (fractions, sums …). */
function canonicalMonomial(s: string): string {
  var t = normalizeFinalAnswer(s)
  if (!t || !/^[a-z0-9^*]+$/.test(t)) return ''
  var tokens = t.match(/[a-z](?:\^\d+)?|\d+(?:\^\d+)?/g)
  if (!tokens || tokens.length === 0) return ''
  tokens.sort()
  return tokens.join('*')
}

/* safe numeric evaluation for pure arithmetic/number forms: dates/years,
 * 2^10 = 1024, 1/2 = 0.5, 50% = 0.5, √50, π, 3:4 ratio, ½ …
 * Returns null for anything with letters (no eval of words). */
function tryNumeric(s: string): number | null {
  var t = normalizeFinalAnswer(s)
  if (!t) return null
  // unicode fractions → explicit division
  t = t.replace(/½/g, '(1/2)').replace(/¼/g, '(1/4)').replace(/¾/g, '(3/4)')
  t = t.replace(/⅓/g, '(1/3)').replace(/⅔/g, '(2/3)')
  // percent: 50% → 50/100 (= 0.5)
  t = t.replace(/%/g, '/100')
  // square roots: √50 → Math.sqrt(50), √(50) → Math.sqrt(50)
  t = t.replace(/√\s*\(?\s*([\d.]+)\s*\)?/g, 'Math.sqrt($1)')
  // pi
  t = t.replace(/π/g, 'Math.PI')
  // ratio "3:4" (as a WHOLE value) = 3/4
  if (/^[\d.]+\s*:\s*[\d.]+$/.test(t.trim())) t = t.trim().replace(/:/, '/')
  t = t.replace(/\^/g, '**')
  if (!/\d/.test(t) && t.indexOf('Math.PI') === -1) return null
  // allow only arithmetic + the Math.sqrt / Math.PI tokens we just built
  var check = t.replace(/Math\.sqrt/g, '').replace(/Math\.PI/g, '')
  if (!/^[\d+\-*/().\s]*$/.test(check)) return null
  try {
    var v = Function('"use strict"; return (' + t + ')')()
    return typeof v === 'number' && isFinite(v) ? v : null
  } catch (e) {
    return null
  }
}

/* EXACT normalized equivalence (never substring) — exported for tests */
export function exactEquivalent(a: string, b: string): boolean {
  var na = normalizeFinalAnswer(a)
  var nb = normalizeFinalAnswer(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // tolerate a leading label like "x=" / "ans:" / "الإجابة:" on either side
  var stripLabel = function (t: string) { return t.replace(/^([a-z]{1,4}|الاجابة|الإجابة|الجواب)[:=]/, '') }
  if (stripLabel(na) === stripLabel(nb)) return true
  // order never matters in enumerations of values: x^6y^4 === y^4x^6
  var ca = canonicalMonomial(a)
  var cb = canonicalMonomial(b)
  if (ca !== '' && cb !== '' && ca === cb) return true
  // pure arithmetic evaluates equal: 2^10 = 1024, 1/2 = 0.5, 50% = 0.5, 3:4 = 3/4
  var va = tryNumeric(a)
  var vb = tryNumeric(b)
  if (va !== null && vb !== null && Math.abs(va - vb) < 1e-9) return true
  // percent-symmetric pass: "50%" ≡ "50" (same value, one wrote the sign and one didn't)
  var stripPct = function (t: string) { return String(t || '').replace(/%/g, '') }
  var va2 = tryNumeric(stripPct(a))
  var vb2 = tryNumeric(stripPct(b))
  if (va2 !== null && vb2 !== null && Math.abs(va2 - vb2) < 1e-9) return true
  return false
}

/* word-overlap similarity (used ONLY to detect "AI read the question text") */
function wordSimilarity(a: string, b: string): number {
  var wa = String(a || '').toLowerCase().replace(/\s+/g, ' ').split(' ').filter(function (w) { return w.length > 1 })
  var wb = String(b || '').toLowerCase().replace(/\s+/g, ' ').split(' ').filter(function (w) { return w.length > 1 })
  if (wa.length === 0 || wb.length === 0) return 0
  var setB: any = {}
  wb.forEach(function (w) { setB[w] = true })
  var hit = 0
  wa.forEach(function (w) { if (setB[w]) hit++ })
  return hit / Math.min(wa.length, wb.length)
}

/* ------------------------------------------------------------------
 * 2026-و25 (نقل 25-a) — مرشّحات الإجابة النهائية (مرادف نسخة جينيوس حرفيًا:
 * نفس المنطق العام — يعمل مع التواريخ والأسماء والأرقام زي ما هو بدون أي
 * افتراض رياضي). المتغير العاري (x, y) ملوش قيمة لوحده — بنمنع مطابقة
 * عاري×عاري. بترجع كل القيم المرشحة للإجابة النهائية: آخر جزء بعد آخر
 * "=" أو ":" + (لو النص جزأين وفيه متغير عاري) الجزء القيمي التاني.
 * ------------------------------------------------------------------ */
export function isBareVariable(s: string): boolean {
  return /^[a-z]{1,2}$/.test(normalizeFinalAnswer(s))
}

function finalAnswerCandidatesSingle(text: string): string[] {
  var t = String(text || '').toLowerCase()
  var parts = t.split(/[=:]/)
  var segs: string[] = []
  for (var i = 0; i < parts.length; i++) {
    var s = (parts[i] || '').trim()
    if (s) segs.push(s)
  }
  var out: string[] = []
  if (segs.length === 0) {
    var whole = t.trim()
    if (whole) out.push(whole)
    return out
  }
  out.push(segs[segs.length - 1])
  if (segs.length === 2) {
    var lastBare = isBareVariable(segs[1])
    var firstBare = isBareVariable(segs[0])
    if (lastBare !== firstBare) {
      if (!firstBare && out.indexOf(segs[0]) === -1) out.push(segs[0])
      if (!lastBare && out.indexOf(segs[1]) === -1) out.push(segs[1])
    }
  }
  return out
}

export function finalAnswerCandidates(text: string): string[] {
  var t = String(text || '').toLowerCase()
  /* بدائل الإجابة المقبولة مفصولة بـ «أو / او / or / |» (زي "١٩٥٢ أو 1952م") —
     بنستخرج مرشحين لكل بديل لوحده عشان أي بديل يعتبر إجابة صحيحة.
     ممنوع القسمة على "/" — دي بتاعة الكسور/التواريخ. */
  var alternatives = t.split(/\s+(?:أو|او|or)\s+|\s*\|\s*/)
    .map(function (x) { return x.trim() })
    .filter(Boolean)
  if (alternatives.length === 0) alternatives = [t]
  var out: string[] = []
  alternatives.forEach(function (alt: string) {
    finalAnswerCandidatesSingle(alt).forEach(function (c: string) {
      if (c && out.indexOf(c) === -1) out.push(c)
    })
  })
  return out
}

/* كل القيم/الحقائق النهائية المقبولة من جهة النموذج: أجزاء الإجابة النموذجية
   + المربّع \\boxed + 【…】 + الإجابات المقبولة الإضافية (نقل 25-a) */
export function modelFinalCandidates(modelAnswer: string, acceptedAnswers?: string[]): string[] {
  var out: string[] = []
  var push = function (v: string) {
    var t = String(v || '').trim()
    if (t && out.indexOf(t) === -1) out.push(t)
  }
  var m = String(modelAnswer || '')
  finalAnswerCandidates(m).forEach(push)
  var boxedM = m.match(/\\boxed\{([^}]+)\}/g) || []
  for (var bi = 0; bi < boxedM.length; bi++) push(boxedM[bi].replace(/^\\boxed\{/, '').replace(/\}$/, ''))
  var jpM = m.match(/【([^】]+)】/g) || []
  for (var ji = 0; ji < jpM.length; ji++) push(jpM[ji].replace(/[【】]/g, ''))
  ;(acceptedAnswers || []).forEach(push)
  return out
}

/* ------------------------------------------------------------------
 * 2026-و25 (نقل 25-a) — STRICT VERIFY: نداء تحقق ثاني رخيص ضد «الـ AI واثق
 * إنه غلط وهو غلطان». لما الحكم الأول يقول غلط بنبعت مكالمة صغيرة مركّزة
 * على حاجة واحدة: «قارن قيم/حقائق الإجابة النهائية بس — نفس القيمة/الحقيقة؟»
 * — لو رجع same=true يقلب الحكم صح. ده اللي بيقتل شكوى «أسئلة صح بيحسبها
 * غلط» من جذورها. مكيّف للدراسات: القيمة/الحقيقة (تاريخ، اسم، رقم، سبب) —
 * الصياغة المختلفة مبتغيرش الحكم.
 * الفشل هنا آمن: لو النداء فشل بنسيب الحكم الأول زي ما هو.
 * ------------------------------------------------------------------ */
export async function verifyFinalAnswerEqual(params: {
  studentFinals: string[]
  modelFinals: string[]
  question?: string
}): Promise<boolean> {
  if (!hasGeminiKey()) return false
  var cut = function (v: string) { return String(v || '').trim().substring(0, 80) }
  var sVals = (params.studentFinals || []).map(cut).filter(Boolean).slice(0, 3)
  var mVals = (params.modelFinals || []).map(cut).filter(Boolean).slice(0, 3)
  if (sVals.length === 0 || mVals.length === 0) return false

  var prompt = 'You are checking ONE thing only: are the student final answer value(s)/fact(s) and the correct final value(s)/fact(s) the SAME?\n\n'
  prompt += 'Compare ONLY the final values/key facts — wording, order, spelling variants, notation and formatting NEVER matter.\n'
  prompt += 'All of these are the SAME: 1952 = 1952م = ١٩٥٢, different Arabic spellings of the same name or term, same facts in a different order, 50% = ٥٠٪ = 0.5, 3,5 = 3.5, ٤٢ = 42, a date written with/without the era marker.\n\n'
  if (params.question) {
    prompt += 'Question (context only): ' + String(params.question).substring(0, 300) + '\n'
  }
  prompt += 'Student final value(s)/fact(s): ' + sVals.join(' | ') + '\n'
  prompt += 'Correct final value(s)/fact(s): ' + mVals.join(' | ') + '\n\n'
  prompt += 'Is ANY student value/fact truly the SAME as ANY correct value/fact? Answer true only if one truly matches; false if every student value/fact is genuinely different.\n'
  prompt += 'Respond with ONLY this JSON — no other text:\n{"same": true}\nor\n{"same": false}\n'

  var result = await callVerifier([{ text: prompt }])
  if (!result.ok || !result.text) return false
  var parsed = parseAIJson(result.text)
  if (!parsed) return false
  return parsed.same === true || parsed.verdict === true || parsed.equal === true
}

/* clamp points to [0, maxPoints] as integer */
function clampPoints(p: any, maxPoints: number): number {
  var n = parseInt(String(p), 10)
  if (isNaN(n) || n < 0) n = 0
  if (n > maxPoints) n = maxPoints
  return n
}

/* ------------------------------------------------------------------
 * IMAGE grading — one multimodal call: read student work + grade.
 * ------------------------------------------------------------------ */
export async function gradeImageAnswer(params: {
  mediaId: string
  question: string
  modelAnswer?: string
  acceptedAnswers?: string[]
  maxPoints?: number
}): Promise<{
  extractedAnswer: string
  finalAnswer?: string
  isCorrect: boolean
  awardedPoints: number
  maxPoints: number
  feedback: string
  onTopic?: boolean
  confidence?: string
  needsGrading?: boolean
  error?: string
}> {
  var rawMediaId = (params.mediaId || '').trim()
  var mediaId = rawMediaId
  if (rawMediaId.indexOf('/') >= 0) {
    var lastSlash = rawMediaId.lastIndexOf('/')
    mediaId = rawMediaId.substring(lastSlash + 1).trim()
  }
  mediaId = mediaId.replace(/^["']|["']$/g, '')
  var question = params.question || ''
  var modelAnswer = params.modelAnswer || ''
  var acceptedAnswers = Array.isArray(params.acceptedAnswers) ? params.acceptedAnswers : []
  var maxPoints = typeof params.maxPoints === 'number' ? params.maxPoints : 5

  var MANUAL = {
    extractedAnswer: '',
    isCorrect: false,
    awardedPoints: 0,
    maxPoints: maxPoints,
    feedback: 'التصحيح الذكي مش متأكد من الإجابة دي — هتتراجع من المستر',
    needsGrading: true,
  }

  if (!mediaId) {
    return Object.assign({}, MANUAL, { feedback: 'mediaId required', error: 'mediaId required' })
  }
  if (!hasGeminiKey()) {
    return Object.assign({}, MANUAL, { feedback: 'AI غير متاح — هتتراجع من المستر', error: 'no api key' })
  }

  // Fetch the media record (image stored as base64)
  var media: any = null
  try {
    media = await db.media.findUnique({ where: { id: mediaId } })
  } catch (e) {
    try {
      var rows = await db.$queryRawUnsafe('SELECT id, filename, fileType, data FROM Media WHERE id = ? LIMIT 1', mediaId)
      media = rows && rows.length > 0 ? rows[0] : null
    } catch (e2) {
      media = null
    }
  }
  if (!media || !media.data) {
    return Object.assign({}, MANUAL, { feedback: 'الصورة غير موجودة — هتتراجع من المستر', error: 'media not found' })
  }

  var mimeType = media.fileType || 'image/jpeg'
  if (!mimeType.startsWith('image/')) {
    if (mimeType.includes('png') || (media.filename || '').endsWith('.png')) mimeType = 'image/png'
    else if (mimeType.includes('webp') || (media.filename || '').endsWith('.webp')) mimeType = 'image/webp'
    else mimeType = 'image/jpeg'
  }

  // ---------- STRICT GRADING PROMPT (studies & history) ----------
  var acceptedStr = acceptedAnswers.length > 0
    ? '\nOther accepted answers: ' + acceptedAnswers.join(' | ')
    : ''

  var prompt = 'You are an expert, STRICT school teacher of Social Studies (الدراسات الاجتماعية) and History grading one student submission. The student answers in Arabic (Egyptian curriculum).\n\n'
  prompt += 'THE QUESTION the student answered:\n' + question + '\n\n'
  if (modelAnswer) {
    prompt += 'MODEL ANSWER (الإجابة النموذجية):\n' + modelAnswer + '\n'
  }
  prompt += acceptedStr + '\n\n'
  prompt += 'The student attached a PHOTO that is supposed to show THEIR OWN handwritten or typed answer to the question above.\n\n'
  prompt += 'Follow these steps EXACTLY:\n'
  prompt += 'STEP 1 — Look at the photo. Identify the STUDENT\'S OWN work: handwriting/typing produced by the student (the answer, keywords, dates, names, calculations).\n'
  prompt += 'STEP 2 — IGNORE all pre-printed content: the question text itself, choice lists, headers, logos, other questions on the page. The student did not write those, and they are NOT their answer.\n'
  prompt += 'STEP 3 — TOPIC CHECK (onTopic): does the photo actually contain the student\'s OWN answer attempt to THIS exact question? If it only shows the printed question, or a different question, or nothing at all → onTopic=false.\n'
  prompt += 'STEP 4 — If onTopic: find the student\'s FINAL ANSWER. Priority order:\n'
  prompt += '   (a) If ANY value/statement is written inside a BOX / frame / مربع / circled at the end → THAT is the final answer. Students are taught to box their final answer — the box is the answer, ALWAYS.\n'
  prompt += '   (b) If there is no box → the final answer is the LAST thing they wrote: after the last "=" or ":", or the concluding line/keyword.\n'
  prompt += '   CRITICAL: every intermediate step, every middle fact, every scratched-out attempt is NOT the answer. Do NOT judge an intermediate note. Many students write messy middle work and still end with the CORRECT boxed final answer — that is CORRECT, full marks. If you compare a middle step against the model answer instead of the boxed/last value, you FAIL. Read it UNDERSTANDING what they mean — messy handwriting DOES NOT matter.\n'
  prompt += 'STEP 5 — Compare the student\'s final answer with the MODEL ANSWER (الإجابة النموذجية) and accepted answers by MEANING and by VALUE, not by exact wording. The student does NOT need to copy the model answer word-for-word; if their answer conveys the same correct fact(s), names, dates, numbers or reasons, it is CORRECT. Equivalent forms are CORRECT: ١٩٥٢ = 1952 = 1952م, different Arabic spellings of the same name or term, listing the same points in a different order, numeric forms ٥٠٪ = 50% = 0.5, 3:4 = 3/4, 3,5 = 3.5, and units/labels are IGNORED (12 سم = 12 cm = 12), a final value contained inside the model\'s fuller answer.\n'
  prompt += 'STEP 6 — Grade by the KEY FACTS the question asks for: a complete correct key fact earns credit; missing or wrong key facts lose credit proportionally. A correct final answer with messy/unreadable steps is still CORRECT (full points). A genuinely DIFFERENT final answer is WRONG even if the wording looks nice. Never mark an answer wrong just because the handwriting is hard to read — judge the final answer.\n'
  prompt += 'STEP 6.5 — UNDERSTAND the solution like a human teacher (as if the student is explaining it to you), NEVER literal matching: a small SLIP in a MIDDLE step (a naming slip, a small factual slip the student self-corrected right after, a crossed-out attempt) does NOT make the work wrong when the student ENDED at the correct final answer with the right key facts. Judge where they ENDED.\n'
  prompt += 'STEP 6.6 — READ THE HANDWRITING CAREFULLY (the worst failure is grading a CORRECT answer as wrong because you misread it): read every handwritten digit/word with FULL attention (4 vs 9, 1 vs 7, 5 vs 3, 0 vs 6). Re-read the final answer TWICE before deciding. If what you read matches the model answer → it is CORRECT, full stop.\n'
  prompt += 'STEP 7 — ALWAYS give a definite verdict (isCorrect true or false). Only say onTopic=false when the photo truly contains NO student work at all.\n\n'
  prompt += 'awardedPoints: an integer from 0 to ' + maxPoints + '. HARD RULE — no partial credit: if isCorrect=true then awardedPoints MUST be exactly ' + maxPoints + ' (NEVER deduct for messy/hard-to-read/unfinished-looking steps when the final answer is right); if isCorrect=false then awardedPoints MUST be 0.\n\n'
  prompt += 'FEEDBACK STYLE (2026-و24-c — the teacher wants a PERSONAL note on EVERY question, like a teacher sitting with the student): write the feedback in Egyptian Arabic talking DIRECTLY to the student (استخدم «انت») — 2-3 short sentences. CORRECT → praise + say exactly WHAT the student did right (the key facts/points he covered). WRONG → (1) point at the EXACT part/key fact where the answer went wrong, (2) show the correct idea/way to answer it, (3) give the correct answer. NEVER generic (ممنوع «إجابة غلط» لوحدها).\n\n'
  prompt += 'Respond with ONLY this JSON — no markdown, no extra text:\n'
  prompt += '{"onTopic": true, "extractedAnswer": "إجابة الطالب زي ما كتبها (3 سطور كحد أقصى)", "finalAnswer": "الإجابة النهائية/النقطة الأساسية في إجابته", "isCorrect": true, "awardedPoints": ' + maxPoints + ', "confidence": "high", "feedback": "ملاحظة بالمصري للطالب: ليه صح أو ليه غلط + إزاي يصلح لو غلط — كأنك بتكلمه بجد (2-3 جمل قصيرة)"}\n'

  var parts = [
    { text: prompt },
    { inlineData: { mimeType: mimeType, data: media.data } },
  ]

  var result = await callGrader(parts, 60000)

  if (!result.ok) {
    console.error('[gradeImageAnswer] Gemini failed:', result.error)
    return Object.assign({}, MANUAL, { error: result.error })
  }

  var parsed = parseAIJson(result.text || '')
  if (!parsed) {
    console.error('[gradeImageAnswer] Failed to parse:', (result.text || '').substring(0, 200))
    return Object.assign({}, MANUAL, { error: 'parse failed' })
  }

  var onTopic = parsed.onTopic !== false
  var confidence = String(parsed.confidence || 'high').toLowerCase()
  var extractedAnswer = String(parsed.extractedAnswer || '').trim()
  var finalAns = String(parsed.finalAnswer || parsed.final_answer || '').trim()
  // لو الـ AI معملش حقل finalAnswer → نجرب نستخرجه من آخر سطر في الـ extracted
  if (!finalAns && extractedAnswer) {
    var fromExtract = finalPart(extractedAnswer)
    if (fromExtract) finalAns = fromExtract
  }
  var isCorrect = parsed.isCorrect === true
  var awardedPoints = clampPoints(parsed.awardedPoints, maxPoints)
  var feedback = String(parsed.feedback || '').trim()
  var needsGrading = false

  // ---- GUARD 0 (2026-و19): الصورة واصلة **مقطوعة/ناقصة** — صور رفع قديم
  // قبل إصلاح تجميع الأجزاء (أول 2MB بس كانت بتتحفظ). ممنوع صفر ظالم على
  // عيب في الرفع مش في حل الطالب: درجة محاولة عادلة (نص الدرجة) والأستاذ
  // يقدر يعدلها يدويًا من الأدمن. الصور الجديدة بعد إصلاح الرفع بتوصل كاملة.
  var truncHay = (feedback + ' \n ' + extractedAnswer).toLowerCase()
  var truncHint = /(?:الصورة|الصوره|الصور|photo|image|picture|screenshot)[^\n.]{0,40}(?:مقطوع|مقصوص|متقطع|ناقص|ناقصة|غير كامل|مش كامل|مش مكتمل|غير مكتمل|cut|cropped|truncat|incomplete|partial)|(?:cut off|cut-off|truncated|incomplete|cropped|partially)[^\n.]{0,30}(?:photo|image|picture)|only (?:the )?(?:top|first|upper|beginning|part of)[^\n.]{0,40}(?:photo|image|visible|shown|page)/i.test(truncHay)
  if (!isCorrect && truncHint) {
    var fairAttempt = maxPoints > 0 ? Math.max(1, Math.ceil(maxPoints / 2)) : 0
    return {
      extractedAnswer: extractedAnswer,
      finalAnswer: finalAns,
      isCorrect: false,
      awardedPoints: fairAttempt,
      maxPoints: maxPoints,
      feedback: feedback
        ? feedback + ' — الصورة وصلت ناقصة (رفع قديم) فاتحسبت درجة محاولة عادلة؛ عدّلها يدويًا من هنا لو حل الطالب كامل وصحيح'
        : 'الصورة وصلت ناقصة (رفع قديم قبل إصلاح الرفع) — اتحسبت نص الدرجة كمحاولة عادلة، عدّلها يدويًا من الأدمن لو الحل كامل وصحيح',
      onTopic: true,
      confidence: 'low',
      needsGrading: false,
    }
  }

  // ---- GUARD 1: photo is not actually the student's answer to THIS question.
  // Decisive verdict (0 points + clear feedback) instead of stalling on manual
  // review — the teacher can override from the admin panel if needed.
  if (!onTopic) {
    return {
      extractedAnswer: extractedAnswer,
      finalAnswer: finalAns,
      isCorrect: false,
      awardedPoints: 0,
      maxPoints: maxPoints,
      feedback: feedback || 'الصورة مفيهاش إجابة واضحة للسؤال ده — لو ده حل الطالب صحّحه من الأدمن',
      onTopic: false,
      confidence: confidence,
      needsGrading: false,
    }
  }

  // ---- GUARD 2: the "extracted answer" is basically the QUESTION text
  // (the model read the printed question instead of the student's work).
  // Only a problem when there is NO final answer to grade — with a real
  // finalAnswer we grade by it and never stall the submission.
  if (question && extractedAnswer && !finalAns && wordSimilarity(extractedAnswer, question) >= 0.8) {
    return {
      extractedAnswer: extractedAnswer,
      finalAnswer: finalAns,
      isCorrect: false,
      awardedPoints: 0,
      maxPoints: maxPoints,
      feedback: 'مفيش إجابة نهائية واضحة في الصورة — راجعها من الأدمن لو الطالب حصل حل',
      onTopic: true,
      confidence: 'low',
      needsGrading: true,
    }
  }

  // ---- GUARD 3: exact-equivalence false-negative fix (AI said wrong but the
  // final answers are EXACTLY equivalent after normalization).
  // Candidates: model final part + ALL boxed values in the model answer + accepted.
  if (!isCorrect && finalAns) {
    var candidates: string[] = []
    if (modelAnswer) {
      candidates.push(finalPart(modelAnswer))
      var boxedM = modelAnswer.match(/\\boxed\{([^}]+)\}/g) || []
      for (var bi = 0; bi < boxedM.length; bi++) candidates.push(boxedM[bi].replace(/^\\boxed\{/, '').replace(/\}$/, ''))
      var jpM = modelAnswer.match(/【([^】]+)】/g) || []
      for (var ji = 0; ji < jpM.length; ji++) candidates.push(jpM[ji].replace(/[【】]/g, ''))
    }
    acceptedAnswers.forEach(function (a) { candidates.push(a) })
    for (var ci = 0; ci < candidates.length; ci++) {
      if (candidates[ci] && exactEquivalent(finalAns, candidates[ci])) {
        isCorrect = true
        awardedPoints = maxPoints
        if (!feedback || feedback.indexOf('غلط') >= 0 || feedback.indexOf('خطأ') >= 0 || feedback.indexOf('خاطئة') >= 0) {
          feedback = 'إجابة صحيحة — الإجابة مطابقة'
        }
        break
      }
    }
  }
  // ---- GUARD 3.5 (2026-و25 نقل 25-a): الـ AI رفض والحكم غلط والإجابة النهائية مقروءة
  // → نداء تحقق ثاني رخيص (STRICT VERIFY) يقارن القيم/الحقائق النهائية بس — لو same
  // يقلب صح كاملة. ده بيقتل «بيحسبها غلط وهي صح» في مسار الصور كمان.
  if (!isCorrect && finalAns && (modelAnswer || acceptedAnswers.length > 0)) {
    try {
      var mCandsV = modelFinalCandidates(modelAnswer, acceptedAnswers).slice(0, 3)
      if (mCandsV.length > 0) {
        var sameImg = await verifyFinalAnswerEqual({ studentFinals: [finalAns], modelFinals: mCandsV, question: question })
        if (sameImg) {
          isCorrect = true
          awardedPoints = maxPoints
          needsGrading = false
          if (!feedback || feedback.indexOf('غلط') >= 0 || feedback.indexOf('خطأ') >= 0 || feedback.indexOf('خاطئة') >= 0) {
            feedback = 'إجابة صحيحة — الإجابة النهائية (' + finalAns + ') مطابقة للصحيحة (اتأكدنا منها مرتين)'
          }
        }
      }
    } catch (verErr) { console.error('[gradeImageAnswer] verify error:', verErr) }
  }
  // AI said correct but gave 0 points → give full
  // 2026-و19 — الصح = الدرجة كاملة دايمًا (الموديل كان بيفهم صح ويخصم نقطة ببلاش 4/5)
  if (isCorrect) awardedPoints = maxPoints
  // AI said wrong → 0 points, period
  if (!isCorrect) awardedPoints = 0

  // ---- GUARD 4: honest review when the AI says WRONG but is not sure it even
  // READ the final answer correctly (unreadable / missing final value) —
  // a false ZERO is worse than a quick manual review.
  if (!isCorrect && (confidence === 'low' || !finalAns)) {
    needsGrading = true
    awardedPoints = 0
    if (!feedback) feedback = 'التصحيح الذكي مش متأكد إنه قري الإجابة النهائية صح من الصورة — راجعها من هنا'
  }

  // ---- GUARD 5: low confidence on a CORRECT verdict never blocks.
  if (confidence === 'low' && isCorrect && !feedback) {
    feedback = 'إجابة صحيحة (بثقة منخفضة — راجعها لو شكيت)'
  }

  // display text: work + final answer
  var displayExtracted = extractedAnswer
  if (finalAns && finalAns !== extractedAnswer) {
    displayExtracted = (extractedAnswer ? extractedAnswer + '\n' : '') + 'الإجابة النهائية: ' + finalAns
  }

  return {
    extractedAnswer: displayExtracted,
    finalAnswer: finalAns,
    isCorrect: isCorrect,
    awardedPoints: awardedPoints,
    maxPoints: maxPoints,
    feedback: feedback || (isCorrect ? 'إجابة صحيحة' : 'إجابة مختلفة عن الإجابة الصحيحة'),
    onTopic: true,
    confidence: confidence,
    needsGrading: needsGrading,
  }
}

// Extract media IDs from a student answer that contains image attachment tags.
// Supports:
//   1. [📷 صورة مرفقة: MEDIA_ID]
//   2. [📷 صورة مرفقة: /api/files/MEDIA_ID]
//   3. [📷 صورة مرفقة: /some/path/MEDIA_ID]
//   4. CORRUPTED markers — junk glued after the id like "…/cmt…4y(85owp8h/"
//      → the cuid pattern c[a-z0-9]{14,} is extracted and trailing junk dropped.
export function extractImageMediaIds(answerText: string): string[] {
  if (!answerText || typeof answerText !== 'string') return []
  var matches = answerText.match(/\[📷[^\]]*\]?/g) || []
  var ids: string[] = []
  matches.forEach(function (m) {
    // 1st try: a real /api/files/<id> path (also survives junk right after the id)
    var pathMatch = m.match(/\/api\/files\/(c[a-z0-9]{8,})/i)
    var mediaId = pathMatch ? pathMatch[1] : ''
    if (!mediaId) {
      var idMatch = m.match(/[:\s]\s*([^\]]+)/)
      var raw = idMatch && idMatch[1] ? idMatch[1].trim().replace(/^["']+|["']+$/g, '') : ''
      if (raw) {
        var cuid = raw.match(/c[a-z0-9]{14,}/i)
        if (cuid) mediaId = cuid[0]
        else {
          var lastSlash = raw.lastIndexOf('/')
          mediaId = (lastSlash >= 0 ? raw.substring(lastSlash + 1) : raw).trim()
          mediaId = mediaId.replace(/[^\w\-].*$/, '').trim()
        }
      }
    }
    if (mediaId && ids.indexOf(mediaId) === -1) ids.push(mediaId)
  })
  return ids
}

/* ------------------------------------------------------------------
 * TEXT grading — for writing answers typed without an image.
 * Same strict contract as image grading. The grader UNDERSTANDS the
 * question, finds the FINAL answer and compares by MEANING against the
 * model answer. Verdicts are decisive (gradingStatus stays 'graded' in
 * every caller); needsGrading=true means ONLY "غلط + ثقة واطية" so the
 * decisive submit path gives a fair attempt score instead of a harsh 0 —
 * the teacher can flip any verdict from the admin panel.
 * ------------------------------------------------------------------ */
export async function gradeTextAnswer(params: {
  question: string
  studentAnswer: string
  modelAnswer: string
  acceptedAnswers?: string[]
  maxPoints?: number
}): Promise<{
  extractedAnswer: string
  isCorrect: boolean
  awardedPoints: number
  maxPoints: number
  feedback: string
  confidence?: string
  needsGrading?: boolean
} | null> {
  var question = params.question || ''
  var studentAnswer = params.studentAnswer || ''
  var modelAnswer = params.modelAnswer || ''
  var acceptedAnswers = Array.isArray(params.acceptedAnswers) ? params.acceptedAnswers : []
  var maxPoints = typeof params.maxPoints === 'number' ? params.maxPoints : 5

  // modelAnswer is OPTIONAL now: when missing, the AI answers the question
  // itself and grades against its own solution (nothing left ungraded)
  if (!studentAnswer || (!modelAnswer && !question)) return null
  if (!hasGeminiKey()) return null

  var acceptedStr = acceptedAnswers.length > 0
    ? '\nOther accepted answers: ' + acceptedAnswers.join(' | ')
    : ''

  var prompt = 'You are an expert, FAIR school teacher of Social Studies (الدراسات الاجتماعية) and History. Grade the student\'s typed answer against the MODEL ANSWER by MEANING and by the FINAL answer — never by literal wording. The student answers in Arabic (Egyptian curriculum).\n\n'
  prompt += 'THE QUESTION:\n' + repairCorruptMath(question) + '\n\n'
  prompt += 'STUDENT ANSWER:\n' + repairCorruptMath(studentAnswer) + '\n\n'
  prompt += 'MODEL ANSWER (الإجابة النموذجية):\n' + (modelAnswer ? repairCorruptMath(modelAnswer) : '(none - ANSWER the question yourself first: work out the correct complete answer (names, dates, reasons, key facts), then grade the student answer against YOUR own answer. Grade on the key facts AND the reasoning: complete correct facts → full points, correct idea with a small gap → about half, wrong or unrelated → 0)') + '\n'
  prompt += acceptedStr + '\n\n'
  prompt += 'CORE PRINCIPLE — find the student\'s FINAL answer (usually after the last "=", ":" or the concluding line) and compare it + the key facts with the model answer. The student answer is CORRECT (full points) whenever it conveys the same correct fact(s)/final value, even if written differently:\n'
  prompt += '- Different wording: the student uses their own words → still CORRECT\n'
  prompt += '- Equivalent forms: ١٩٥٢ = 1952 = 1952م, different Arabic spellings of the same name/term, same points in a different order, numeric forms ٥٠٪ = 50% = 0.5, 3:4 = 3/4, 3,5 = 3.5; units and labels are IGNORED (12 سم = 12 cm = 12)\n'
  prompt += '- The final value may be CONTAINED in the model solution (model shows steps, student wrote only the final result) → still CORRECT\n'
  prompt += 'Rules:\n'
  prompt += '1. UNDERSTAND the question first: what key fact(s), names, dates, reasons or terms does it ask for?\n'
  prompt += '2. Extract the student\'s FINAL answer (after the last "=" or the last result/conclusion written).\n'
  prompt += '3. Compare ONLY final values/key facts with the model final answer / accepted answers — accept all equivalent forms above.\n'
  prompt += '3b. UNDERSTAND the answer like you are talking with the student — interpret what they MEANT (never literal string matching). A small slip in a MIDDLE step that the student self-corrected does NOT make the work wrong when the FINAL answer is right — judge where they ENDED.\n'
  prompt += '4. Grade by the key facts: complete correct key facts → full credit; partially correct → partial credit; wrong or unrelated → 0.\n'
  prompt += '5. If the student answer does not actually address the question (e.g. it is just the question text, or unrelated) → isCorrect=false and confidence="low" — but STILL a definite verdict.\n'
  prompt += '6. Never guess randomly. If unsure → confidence="low" and give your best verdict — the teacher reviews it from the admin panel.\n'
  prompt += '7. READ CAREFULLY (worst failure = a correct answer graded wrong): re-read the student final answer TWICE — read every digit/word carefully. If what you read matches the model answer → CORRECT, full stop.\n\n'
  prompt += 'FEEDBACK STYLE (2026-و24-c): the feedback must sound like a real teacher sitting with the student in Egyptian Arabic — talk to him directly (استخدم «انت»), 2-3 short sentences. CORRECT → praise + say exactly WHAT the student did right (the key facts/points he covered). WRONG → (1) point at the EXACT part/key fact where the answer went wrong, (2) show the correct idea/way to answer it, (3) give the correct answer. NEVER generic.\n\n'

  prompt += 'awardedPoints: integer 0 to ' + maxPoints + '. HARD RULE — no partial credit: isCorrect=true ⇒ awardedPoints exactly ' + maxPoints + '; isCorrect=false ⇒ 0.\n\n'
  prompt += 'Respond with ONLY this JSON — no markdown:\n'
  prompt += '{"isCorrect": true, "awardedPoints": ' + maxPoints + ', "confidence": "high", "feedback": "ملاحظة بالمصري للطالب: ليه صح أو ليه غلط + إزاي يصلح لو غلط — كأنك بتكلمه بجد (2-3 جمل قصيرة)"}\n'

  var result = await callGrader([{ text: prompt }])
  if (!result.ok || !result.text) return null

  var parsed = parseAIJson(result.text)
  if (!parsed) return null

  var isCorrect = parsed.isCorrect === true
  var confidence = String(parsed.confidence || 'high').toLowerCase()
  var awardedPoints = clampPoints(parsed.awardedPoints, maxPoints)

  // exact-equivalence false-negative fix
  if (!isCorrect) {
    var candidates: string[] = []
    candidates.push(finalPart(modelAnswer))
    acceptedAnswers.forEach(function (a) { candidates.push(a) })
    var studentFinal = finalPart(studentAnswer)
    for (var ci = 0; ci < candidates.length; ci++) {
      if (candidates[ci] && studentFinal && exactEquivalent(studentFinal, candidates[ci])) {
        isCorrect = true
        break
      }
    }
  }
  // ---- STRICT VERIFY (2026-و25 نقل 25-a): الـ AI واثق إنه غلط؟ نداء تحقق ثاني رخيص
  // يقارن قيم/حقائق الإجابة النهائية بس — لو رجع same يقلب الحكم صح كاملة.
  // ده علاج شكوى «أسئلة صح بيحسبها غلط» — المقارنة الأولى بتغلط في قراية
  // الشكل/الصياغة، والتحديده بيتم على القيمة/الحقيقة بس.
  if (!isCorrect && (modelAnswer || acceptedAnswers.length > 0)) {
    try {
      var sCandsV = finalAnswerCandidates(studentAnswer).slice(0, 3)
      if (sCandsV.length > 0) {
        var mCandsV = modelFinalCandidates(modelAnswer, acceptedAnswers).slice(0, 3)
        if (mCandsV.length > 0) {
          var sameTxt = await verifyFinalAnswerEqual({ studentFinals: sCandsV, modelFinals: mCandsV, question: question })
          if (sameTxt) {
            isCorrect = true
            awardedPoints = maxPoints
            confidence = 'high'
            feedback = 'برافو عليك ✓ الإجابة النهائية (' + sCandsV[0] + ') مطابقة للإجابة الصحيحة — تم التأكد مرتين'
          }
        }
      }
    } catch (verErr) { console.error('[gradeTextAnswer] verify error:', verErr) }
  }
  // 2026-و19 — الصح = الدرجة كاملة دايمًا (الموديل كان بيفهم صح ويخصم نقطة ببلاش 4/5)
  if (isCorrect) awardedPoints = maxPoints
  if (!isCorrect) awardedPoints = 0

  return {
    extractedAnswer: studentAnswer,
    isCorrect: isCorrect,
    awardedPoints: awardedPoints,
    maxPoints: maxPoints,
    feedback: String(parsed.feedback || '').trim() || (isCorrect ? 'إجابة صحيحة' : 'إجابة مختلفة عن الإجابة الصحيحة'),
    confidence: confidence,
    // غلط + ثقة واطية → نعلّمها "مش متأكد" عشان المسار الحاسم في التسليم
    // يدي درجة محاولة عادلة بدل صفر ظالم — ومفيش needsGrading معلقة خالص:
    // المستر يقدر يعدّل أي حكم من لوحته (نفس قرار maths-genius وشيماء)
    needsGrading: !isCorrect && confidence === 'low',
  }
}
