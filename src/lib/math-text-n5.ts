// ============================================================
// FILE: src/lib/math-text-n5.ts (وN5-port)
// نسخة محمولة: cleanEscapeGarbage + cleanTextDeep — إبادة حرف الـ N
// وبقايا escapes الاستخراج (\na. \nb. / na. nb.) — مستقلة بلا اعتماديات
// ============================================================

var LATEX_KEEP_RE = /(\\(?:dfrac|tfrac|frac|cbrt|sqrt|times|div|text|left|right|beta|boxed|theta|therefore|thereis|binom|overline|underline|underbrace|vec|hat|widetilde|alpha|beta|gamma|delta|Delta|lambda|mu|rho|sigma|phi|omega|pi|pm|mp|le|ge|neq|nabla|notin|not|quad|approx|equiv|angle|circ|degree|cdot|infty|perp|parallel|triangle|sum|prod|int|lim))(?![a-zA-Z])/g

export function cleanEscapeGarbage(input: string): string {
  if (!input) return input
  var s = String(input)
  /* الحارس: شرطة أو مَعلم أو n ملتحومة (بلا شرطة — استخراجات قديمة) —
     من غير ده النص الملتحوم بس («na. nb. nc.») بيرجع زي ما هو غلط */
  var hasBackslash = s.indexOf('\\') !== -1
  var hasMarker = s.indexOf('\u0001') !== -1
  var hasFusedN = !hasBackslash && !hasMarker && (
    /([0-9a-zA-Z])n([a-hA-H][).:\-–])/.test(s) || /(\s)n([a-hA-H][).:\-–])/.test(s)
  )
  if (!hasBackslash && !hasMarker && !hasFusedN) return input
  /* 0) \uXXXX الحرفية → الحرف الحقيقي */
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, function (_m: string, hex: string) {
    return String.fromCharCode(parseInt(hex, 16))
  })
  /* 1) حماية أوامر LaTeX المشروعة بمَعالم مؤقتة */
  var kept: string[] = []
  s = s.replace(LATEX_KEEP_RE, function (m: string) {
    kept.push(m)
    return '\u0001' + (kept.length - 1) + '\u0001'
  })
  /* 2) أسطر حقيقية من \r\n و \n الحرفية */
  s = s.replace(/\\r\\n/g, '\n')
  s = s.replace(/\\n/g, '\n')
  s = s.replace(/\\r/g, '\n')
  s = s.replace(/\\t/g, ' ')
  /* 3) \ حرف واحد تالف → الحرف لوحده (بقايا فواصل اختيارات \a \b \c …) */
  s = s.replace(/\\([a-zA-Z])/g, '$1')
  /* 3ب) الـ n الملتحومة — شرطتها اتشالت في طبقة قديمة فالنص بقى
     «a. 2nb. …\nc. 4 x sn- …mnf. …ng.» — بنفكّها لسطر جديد بس لما
     تكرر مرتين أو أكتر في نفس النص (عشان ما نلمسش كلمة لاتينية سليمة) */
  var fusedN = s.match(/([0-9a-zA-Z])n([a-hA-H][).:\-–])/g)
  if (fusedN && fusedN.length >= 2) {
    s = s.replace(/([0-9a-zA-Z])n([a-hA-H][).:\-–])/g, '$1\n$2')
  }
  /* 3ج) الـ n الملتحومة بمسافة — «rectangles. na. nb. nc.» — نفس العلة
     بس بمسافة قبل الـ n (استخراجات قديمة الشرطة اتشالت والسطر بقى مسافة)
     — نفس الحارس: مرتين أو أكتر في نفس النص عشان ما نلمسش نص سليم */
  var fusedN2 = s.match(/\s?n([a-hA-H][).:\-–])/g)
  if (fusedN2 && fusedN2.length >= 2) {
    s = s.replace(/\s?n([a-hA-H][).:\-–])/g, '\n$1')
  }
  /* 4) \\ (لاين بريك لاتكس) → سطر جديد — وأي شرطة قبل غير الحروف أو شرطة يتيمة → تتشال */
  s = s.replace(/\\\\/g, '\n')
  s = s.replace(/\\([^\\])/g, '$1')
  s = s.replace(/\\+/g, '')
  /* 5) رجوع المَعالم + تنظيف الأسطر */
  s = s.replace(/\u0001(\d+)\u0001/g, function (_m: string, i: string) {
    return kept[Number(i)] || ''
  })
  s = s.replace(/\n{3,}/g, '\n\n')
  return s
}

/*
 * (ز43) cleanTextDeep — تنظيف كل النصوص جوه أي شكل (سؤال/اختيارات/جدول/
 * موديل أنسر…) بنفس cleanEscapeGarbage — بترجع { val, changed } عشان
 * طبقات الحفظ والتنظيف تعرف لو حاجة اتغيرت فعلًا.
 */
export function cleanTextDeep(node: any): { val: any; changed: boolean } {
  if (node == null) return { val: node, changed: false }
  if (typeof node === 'string') {
    var cleaned = cleanEscapeGarbage(node)
    return { val: cleaned, changed: cleaned !== node }
  }
  if (Array.isArray(node)) {
    var arr: any[] = []
    var ch = false
    for (var i = 0; i < node.length; i++) {
      var r = cleanTextDeep(node[i])
      arr.push(r.val)
      if (r.changed) ch = true
    }
    return { val: arr, changed: ch }
  }
  if (typeof node === 'object') {
    var out: any = {}
    var ch2 = false
    for (var k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue
      var r2 = cleanTextDeep(node[k])
      out[k] = r2.val
      if (r2.changed) ch2 = true
    }
    return { val: out, changed: ch2 }
  }
  return { val: node, changed: false }
}
