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
