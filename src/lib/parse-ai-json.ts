// FILE: src/lib/parse-ai-json.ts
// PURPOSE: Tolerant JSON parser for AI model output.
//          Gemini sometimes returns slightly malformed JSON:
//            a) trailing garbage — closes the root object then appends extra
//               fields like  {...}]},{"answerKey":""}
//            b) truncation — response cut mid-object (rare, long outputs)
//          This parser survives both instead of failing the whole extraction.

export function parseAiJson(text: string): any | null {
  if (!text || !text.trim()) return null
  var objMatch = text.match(/\{[\s\S]*\}/)
  var arrMatch = text.match(/\[[\s\S]*\]/)
  var raw = objMatch ? objMatch[0] : arrMatch ? arrMatch[0] : null
  if (!raw) return null
  // repair LaTeX-eating JSON escapes BEFORE parsing (\frac → \\frac …)
  raw = repairModelJson(raw)

  // 1) direct parse
  try {
    return JSON.parse(raw)
  } catch (e) {}

  // 2) trailing-garbage tolerance: walk back over earlier '}' / ']'
  //    positions until a prefix of the string parses as valid JSON
  var attempts = 0
  for (var i = raw.length - 1; i > 0 && attempts < 200; i--) {
    var c = raw.charAt(i)
    if (c === '}' || c === ']') {
      attempts++
      try {
        return JSON.parse(raw.substring(0, i + 1))
      } catch (e) {}
    }
  }

  // 3) truncation repair: recompute open brackets and append what's missing
  var stack: string[] = []
  var inStr = false
  var esc = false
  for (var j = 0; j < raw.length; j++) {
    var ch = raw.charAt(j)
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
    } else {
      if (ch === '"') inStr = true
      else if (ch === '{') stack.push('}')
      else if (ch === '[') stack.push(']')
      else if (ch === '}' || ch === ']') {
        if (stack.length) stack.pop()
      }
    }
  }
  if (stack.length > 0 && stack.length <= 8) {
    var repaired = raw
    if (inStr || esc) repaired += '"'
    while (stack.length) repaired += stack.pop()
    try {
      return JSON.parse(repaired)
    } catch (e) {}
  }

  return null
}

/*
 * repairCorruptMath — fix ALREADY-CORRUPTED stored text (render time / prompt
 * building). Ported from maths-genius src/lib/math-text.ts — منصة القائد
 * مفيش عليها ملف math-text منفصل فالمكان ده هو مركز إصلاح نص الرياضيات.
 * Safe on any string: only touches control chars sitting exactly where a
 * LaTeX command would start, plus the bare "rac{" leftover signature.
 * Also repairs structurally-broken LaTeX the models keep producing:
 *   \frac{A}^{B}   →  \frac{A}{B}
 *   a^b^c          →  a^{b^{c}}     (nested exponents stack properly)
 */
export function repairCorruptMath(input: string): string {
  if (!input) return input
  var s = String(input)
  // U+FFFD replacement chars are lossy-encoding leftovers — never legitimate
  s = s.replace(/\uFFFD/g, '')
  // ---- power heal (multi-digit powers stored broken by the old keyboard bug) ----
  // "2¹0" → "2¹⁰" , "x²15" → "x²¹⁵" : a superscript run followed by normal-size
  // digits was ALWAYS meant to be one whole power — join them at render time.
  // Also upgrades Arabic-Indic digits that got stuck onto a Latin superscript run.
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹])([0-9٠-٩]+)/g, function (_m, sup: string, digits: string) {
    var SUP_OF: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '٠': '⁰', '١': '¹', '٢': '²', '٣': '³', '٤': '⁴',
      '٥': '⁵', '٦': '⁶', '٧': '⁷', '٨': '⁸', '٩': '⁹',
    }
    var out = sup
    for (var i = 0; i < digits.length; i++) out += SUP_OF[digits[i]] || digits[i]
    return out
  })
  // <FF>rac{…} → \frac{…}  (restore only when letters follow — a real command)
  s = s.replace(/\f(?=[a-zA-Z])/g, '\\f')
  // leftover invisible FF junk (not part of a command) → drop
  s = s.replace(/\f/g, '')
  // <TAB>imes / <TAB>ext / <TAB>heta … → \times / \text / \theta
  s = s.replace(/\t(?=(?:imes|ext|heta|herefore|hereis|binom))([a-z]*)/g, '\\t$1')
  // <BS>eta / <BS>oxed → \beta / \boxed
  s = s.replace(/[\u0008](?=(?:eta|oxed|inom|ig))/g, '\\b')
  // <CR>ight / <CR>ho / <CR>angle → \right / \rho / \rangle
  s = s.replace(/\r(?=(?:ho|ight|angle|m))/g, '\\r')
  // stray CR without a command after it → plain newline
  s = s.replace(/\r/g, '\n')
  // bare "rac{…}" (control char already stripped by an older lossy layer) → \frac{…}
  s = s.replace(/(^|[^\\a-zA-Z])rac(?=[\s{(])/g, '$1\\frac')
  // ---- structural repairs (model-authored broken LaTeX) ----
  // \frac{A}^{B} or \frac(A)^{B}  →  \frac{A}{B}
  for (var p = 0; p < 2; p++) {
    s = s.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\^\s*\{([^{}]*)\}/g, '\\frac{$1}{$2}')
    s = s.replace(/\\(?:d|t)?frac\s*\(([^()]*)\)\s*\^\s*\{([^{}]*)\}/g, '\\frac{$1}{$2}')
  }
  // chained exponents  a^b^c  →  a^{b^{c}}  (repeat to catch triples; ASCII + Arabic-Indic digits)
  var SUP_ATOM = '(\\{(?:[^{}]|\\{[^{}]*\\})*\\}|[A-Za-z0-9\\u0660-\\u0669\\u06F0-\\u06F9]+)'
  for (var q = 0; q < 3; q++) {
    var chainRe = new RegExp('\\^\\s*' + SUP_ATOM + '\\s*\\^\\s*' + SUP_ATOM, 'g')
    s = s.replace(chainRe, function (_m, a: string, b: string) {
      return '^{' + a + '^{' + b + '}}'
    })
  }
  return s
}

/*
 * repairModelJson — prepare raw model output BEFORE JSON.parse so LaTeX with
 * single backslashes survives as text instead of being eaten by JSON escapes
 * (\frac → form-feed + "rac", \times → tab + "imes" …).
 * Single-pass scanner — see maths-genius src/lib/math-text.ts for docs.
 */
export function repairModelJson(raw: string): string {
  var s = String(raw)
  if (s.indexOf('\\') === -1) return s
  var out = ''
  var i = 0
  var n = s.length
  while (i < n) {
    var c = s.charAt(i)
    if (c !== '\\') { out += c; i += 1; continue }
    var next = s.charAt(i + 1)
    if (next === undefined || next === '') { out += '\\\\'; i += 1; continue }
    if (next === '\\') { out += '\\\\'; i += 2; continue }
    if (next === 'u' && /^[0-9a-fA-F]{4}/.test(s.slice(i + 2))) { out += s.slice(i, i + 6); i += 6; continue }
    var rest = s.slice(i + 2)
    var isLatexCollide =
      (next === 'f' && /^rac/.test(rest)) ||
      (next === 't' && /^(?:imes|ext|heta|herefore|hereis|binom)/.test(rest)) ||
      (next === 'b' && /^(?:eta|oxed|inom)/.test(rest)) ||
      (next === 'r' && /^(?:ho|ight|angle|m)/.test(rest)) ||
      (next === 'n' && /^(?:eq|abla|otin|quad|parallel)/.test(rest))
    if (isLatexCollide) { out += '\\\\' + next; i += 2; continue }
    if (/^["\\/bfnrt]/.test(next)) { out += '\\' + next; i += 2; continue }
    if (/^[{}[\]$%&_^]/.test(next)) { out += '\\\\' + next; i += 2; continue }
    out += '\\\\' + next; i += 2; continue
  }
  return out
}
