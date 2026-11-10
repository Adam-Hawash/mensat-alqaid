// ============================================================
// FILE: src/lib/question-split.ts (وN5-port)
// نسخة مستقلة محمولة من question-figures — تفكيك الاختيارات المدموجة
// + كشف الرسومات المرئية — من غير أي اعتماديات خارجية
// ============================================================

/** هل السؤال ده له اختيارات مرئية (صور/رسومات في الاختيارات)؟ */
export function hasVisualOptions(q: any): boolean {
  if (!q || typeof q !== 'object') return false
  if (!Array.isArray(q.optionFigures)) return false
  return q.optionFigures.some(function (of: any) {
    return of && typeof of === 'object' && (of.url || of.bbox)
  })
}

/**
 * الحكم الموحد: هل السؤال مقالي؟
 * مقالي = مفيش اختيارات نصية مرة واحدة ومفيش رسومات اختيارات.
 * أي اختيارات (نص أو صور) → اختياري زي ما هو.
 */
export function isWritingQuestion(q: any): boolean {
  if (!q || typeof q !== 'object') return true
  if (hasVisualOptions(q)) return false
  if (Array.isArray(q.options) && q.options.length > 0) {
    // اختيارات موجودة — لو كلها فاضية/N/A من غير رسومات → مقالي
    var allNA = q.options.every(function (o: any) {
      return !o || o === 'N/A' || o === 'لا يوجد' || String(o).trim() === ''
    })
    return allNA
  }
  return true
}

/* ============================================================
 * (ز43) SPLIT-EMBEDDED-OPTIONS — العقل الذكي لتفكيك الاختيارات المدموجة
 * ============================================================
 * طلب المستر الحرفي: «لو السؤال من الكتاب فيه A B C فهو يقسمهم سؤال واحد
 * A B C ويقص الرسومات زيهم — التلات رسومات يكونوا في السؤال واحد».
 *
 * الموديل ساعات بيرجّع الاختيارات مدموجة جوه نص السؤال:
 *   «Use two different formulas…\na. 2\nb. 2 x (1 + w)\nc. 4 x s»
 * بعد تنظيف escapes (cleanEscapeGarbage) السطر بيبقى:
 *   «…\na. 2\nb. 2 x (1 + w)\nc. 4 x s»
 * والفانكشن دي بتلاقي علامات الاختيارات المتتالية (a,b,c / 1,2,3 / أ,ب,ج)
 * وتفكّها: نص السؤال يفضل السؤال، وكل جزء يبقى اختيار حقيقي — ولو فيه
 * رسمة واحدة عريضة، بنعلّم السؤال بـ _figureSplitPending عشان مرحلة
 * القص تقطّعها لرسومات اختيارات (شوف ensureFigureUrls).
 *
 * شروط الأمان (لو أي شرط فشل → السؤال يرجع زي ما هو):
 *   • مفيش اختيارات حقيقية ولا رسومات اختيارات بالفعل
 *   • علامتين متتاليتين على الأقل من نفس العائلة بالترتيب
 *   • نص السؤال قبل أول علامة ≥ 6 حروف
 * ============================================================ */

interface OptMarker { idx: number; len: number; sym: string; order: number }

var OPT_FAMILIES: { name: string; re: RegExp; order: (s: string) => number }[] = [
  {
    name: 'latin',
    re: /(?:^|[\n\s(•\-–—])(([a-hA-H])\s*[).:\-–\]]\s*)/g,
    order: function (s: string) { return 'abcdefgh'.indexOf(String(s).toLowerCase()) },
  },
  {
    name: 'arabic',
    re: /(?:^|[\n\s(•\-–—])(([أ-ه])\s*[).:\-–]\s*)/g,
    order: function (s: string) { return 'أبجده'.indexOf(String(s)) },
  },
  {
    name: 'digit',
    re: /(?:^|[\n\s(•\-–—])(([1-6])\s*[).:\-–\]]\s*)/g,
    order: function (s: string) { return parseInt(String(s), 10) - 1 },
  },
]

function findOptionRun(text: string): { family: string; first: OptMarker; marks: OptMarker[] } | null {
  var best: { family: string; first: OptMarker; marks: OptMarker[] } | null = null
  for (var fi = 0; fi < OPT_FAMILIES.length; fi++) {
    var fam = OPT_FAMILIES[fi]
    fam.re.lastIndex = 0
    var all: OptMarker[] = []
    var m: RegExpExecArray | null
    while ((m = fam.re.exec(text)) !== null) {
      var full = m[1]
      var sym = m[2]
      var ord = fam.order(sym)
      if (ord < 0) continue
      var idx = m.index + m[0].indexOf(full)
      all.push({ idx: idx, len: full.length, sym: sym, order: ord })
      if (m[0].length === 0) fam.re.lastIndex++
    }
    if (all.length < 2) continue
    /* أطول سلسلة متتالية بالترتيب (a ثم b ثم c…) */
    all.sort(function (a, b) { return a.idx - b.idx })
    var run: OptMarker[] = []
    var bestRun: OptMarker[] = []
    for (var i = 0; i < all.length; i++) {
      if (run.length === 0 || all[i].order === run[run.length - 1].order + 1) {
        run.push(all[i])
        if (run.length > bestRun.length) bestRun = run.slice()
      } else if (all[i].order === run[run.length - 1].order) {
        continue /* نفس الحرف مكرر — تجاهل */
      } else {
        run = [all[i]]
      }
    }
    if (bestRun.length >= 2) {
      var latW = fam.name === 'latin' ? 1 : 0
      var better =
        !best ||
        bestRun.length > best.marks.length ||
        (bestRun.length === best.marks.length && fam.name === 'latin' && best.family !== 'latin')
      if (better) best = { family: fam.name, first: bestRun[0], marks: bestRun }
      void latW
    }
  }
  return best
}

export function splitEmbeddedOptions(q: any): any {
  try {
    if (!q || typeof q !== 'object') return q
    /* شرط 1: مفيش اختيارات حقيقية ولا رسومات اختيارات — وإلا هو أصلاً مظبوط */
    var hasRealOpts = Array.isArray(q.options) && q.options.some(function (o: any) { return String(o == null ? '' : o).trim() !== '' })
    if (hasRealOpts) return q
    if (hasVisualOptions(q)) return q
    var text = String(q.question || q.q || '')
    if (text.length < 12) return q
    /* شرط 2: علامات متتالية */
    var run = findOptionRun(text)
    if (!run || run.marks.length < 2) return q
    /* شرط 3: نص السؤال قبل أول علامة */
    var stem = text.substring(0, run.first.idx).trim()
    if (stem.length < 6) return q
    /* بناء الاختيارات من القطع بين العلامات */
    var segs: string[] = []
    for (var i = 0; i < run.marks.length; i++) {
      var start = run.marks[i].idx + run.marks[i].len
      var end = i + 1 < run.marks.length ? run.marks[i + 1].idx : text.length
      segs.push(text.substring(start, end).replace(/[\n\r]+/g, ' ').trim())
    }
    if (segs.length > 8) segs = segs.slice(0, 8)
    /* لو كل القطع فاضية ومفيش رسمة → مفيش فايدة */
    var anySeg = segs.some(function (s: string) { return s !== '' })
    if (!anySeg && !q.figure) return q
    var out = Object.assign({}, q)
    out.question = stem
    out.options = segs
    out.type = 'mcq'
    var corr = typeof q.correct === 'number' ? q.correct : (parseInt(String(q.correct), 10) || -1)
    out.correct = (corr >= 0 && corr < segs.length) ? corr : -1
    /* رسومات الاختيارات: لو موجودة فضلوا، وإلا علّم عشان القص يقطّع الرسمة العريضة */
    if (Array.isArray(q.optionFigures) && q.optionFigures.length > 0) {
      var ofs = q.optionFigures.slice(0, segs.length)
      while (ofs.length < segs.length) ofs.push(null)
      out.optionFigures = ofs
    } else if (q.figure && q.figure.bbox) {
      out._figureSplitPending = segs.length
    }
    return out
  } catch (e) { return q }
}
