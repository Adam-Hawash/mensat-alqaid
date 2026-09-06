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
