// ============================================================
// grade-names — المرجع الموحد لأسماء الصفوف في كل المنصة
// (توحيد الصفوف — S-4b — نفس منهجية Zicola-Math المثبتة)
// ============================================================
// العلّة اللي كانت: كل صيغ الصفوف بتتخزن بشكل مختلف —
//   «الصف السادس الابتدائي» أحيانًا بتيجي «السادس» أو «سادس ابتدائي»
//   أو «grade 6»، وأولى بكالوريا بتيجي «أولى ثانوي» —
// والقراءة كانت مطابقة نصية حرفية (videos/exams/homework/announcements/
// discussions كانت كلها where.grade = grade) فالمحتوى المضاف لصف ما
// كانش بيظهر لطلاب نفس الصف لو الصيغة اختلفة ولو شوية.
//
// القاعدة دلوقتي — **اسم معتمد واحد لكل صف**:
//   • أي كتابة (storeGrade) بتتخزن بالاسم المعتمد الكامل
//   • أي قراءة (gradeVariants/gradeWhere) بتجيب كل الصيغ القديمة مع بعض
//   • أي عرض (displayGrade) بيرجع الاسم المعتمد الكامل
//
// الأسماء المعتمدة هنا = نفس أسماء DEFAULT_GRADES في src/stores/app-store.ts
// (قايمة لوحة الأدمن الافتراضية بالظبط):
//   «الصف السادس الابتدائي» / «أولى إعدادي» / «تانية إعدادي» /
//   «تالتة إعدادي» / «أولى بكالوريا»
// + عائلات صفوف الابتدائي التانية (رابعة/خامسة/...) لو المستر ضافها من
//   لوحة الصفوف — عشان أي صيغة تتخزن ترجع لاسم معتمد واحد.
// ============================================================

export const GRADE_S1 = 'أولى بكالوريا'          // الاسم المعتمد في المنصة دي
export const GRADE_S1_LEGACY = 'أولى ثانوي'      // صيغة قديمة لنفس الصف

/* ------------------------------------------------------------
   عائلات صفوف الابتدائي — كل صيغة ممكن تتخزن → الاسم المعتمد.
   bareSafe = الصيغة المفردة (من غير كلمة «ابتدائي») آمنة للعيلة دي —
   رابعة/خامسة/سادس مفيش صف تاني بيبدأ بنفس الكلمات، لكن الأول/الثاني/
   التالتة بيتلخبطوا مع الإعدادي/الثانوي («أولى» لوحدها ممكن تكون
   أولى إعدادي أو أولى بكالوريا) فلازم كلمة «ابتدائي» تكون موجودة.
   ------------------------------------------------------------ */
export interface PrimaryGradeFamily {
  ar: string
  en: string
  emoji: string
  short: string
  bareSafe: boolean
  keys: string[]
}

export const PRIMARY_GRADE_FAMILIES: PrimaryGradeFamily[] = [
  {
    /* الصف السادس الابتدائي — الاسم المعتمد في المنصة (DEFAULT_GRADES) */
    ar: 'الصف السادس الابتدائي', en: 'Grade 6', emoji: '6️⃣', short: 'G6', bareSafe: true,
    keys: ['سادس', 'سادسة', 'سادس ابتدائي', 'سادسة ابتدائي', 'السادس الابتدائي', 'السادسة الابتدائي', 'grade 6', 'g6', '6', '٦'],
  },
  {
    ar: 'الرابعة الابتدائي', en: 'Grade 4', emoji: '4️⃣', short: 'G4', bareSafe: true,
    /* «ربعة» و«ربع» بدون ألف كمان — صيغ مصرية شائعة */
    keys: ['رابعة', 'رابع', 'ربعة', 'ربع', 'رابعة ابتدائي', 'رابع ابتدائي', 'ربعة ابتدائي', 'الرابعة الابتدائي', 'grade 4', 'g4', '4', '٤'],
  },
  {
    ar: 'الخامسة الابتدائي', en: 'Grade 5', emoji: '5️⃣', short: 'G5', bareSafe: true,
    /* «خمسة» و«خمس» بدون ألف كمان */
    keys: ['خامسة', 'خامس', 'خمسة', 'خمس', 'خامسة ابتدائي', 'خامس ابتدائي', 'خمسة ابتدائي', 'الخامسة الابتدائي', 'grade 5', 'g5', '5', '٥'],
  },
  {
    ar: 'الأول الابتدائي', en: 'Grade 1', emoji: '1️⃣', short: 'G1', bareSafe: false,
    keys: ['الاول الابتدائي', 'اولي ابتدائي', 'الاولي الابتدائي', 'اول ابتدائي', 'grade 1 primary', 'g1 primary'],
  },
  {
    ar: 'الثاني الابتدائي', en: 'Grade 2', emoji: '2️⃣', short: 'G2', bareSafe: false,
    keys: ['الثاني الابتدائي', 'ثاني ابتدائي', 'الثانية الابتدائي', 'ثانية ابتدائي', 'grade 2 primary', 'g2 primary'],
  },
  {
    ar: 'التالتة الابتدائي', en: 'Grade 3', emoji: '3️⃣', short: 'G3', bareSafe: false,
    keys: ['التالتة الابتدائي', 'تالتة ابتدائي', 'الثالثة الابتدائي', 'ثالثة ابتدائي', 'تالت ابتدائي', 'grade 3 primary', 'g3 primary'],
  },
]


/* تطبيع مفتاح المقارنة: شيل «الصف» + وحّد الهمزات والتاء المربوطة/الألف
   المقصورة والتطويل والتشكيل + اطوي المسافات + lowercase (للاتيني) */
export function gradeKey(name: any): string {
  var g = String(name || '')
  g = g.replace(/^\s*الصف\s+/u, '')
  g = g.replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أ إ آ ٱ → ا
  g = g.replace(/\u0649/g, '\u064A')                     // ى → ي
  g = g.replace(/\u0640/g, '')                           // ـ tatweel
  g = g.replace(/[\u064B-\u0652]/g, '')                  // التشكيل
  g = g.replace(/\s+/g, ' ').trim().toLowerCase()
  return g
}

/* الاسم بدون بادئة «ال» ولاحقة «الابتدائي» — للمطابقة الضبابية جوه العيلة */
function stripBare(key: string): string {
  return key.replace(/^(ال)?/, '').replace(/\s*(ابتدائي|الابتدائي)$/, '').trim()
}

/* ------------------------------------------------------------
   الاسم بيمثل صف ابتدائي من العائلات؟ → بيانات الاسم المعتمد (أو null)
   ------------------------------------------------------------ */
export function primaryGradeCanonical(name: any): PrimaryGradeFamily | null {
  var key = gradeKey(name)
  if (!key) return null
  var bare = stripBare(key)
  var hasIbtidai = key.indexOf('ابتدائي') !== -1
  for (var i = 0; i < PRIMARY_GRADE_FAMILIES.length; i++) {
    var f = PRIMARY_GRADE_FAMILIES[i]
    for (var k = 0; k < f.keys.length; k++) {
      if (key === gradeKey(f.keys[k])) return f
    }
    if (f.bareSafe || hasIbtidai) {
      for (var k2 = 0; k2 < f.keys.length; k2++) {
        var kk2 = stripBare(gradeKey(f.keys[k2]))
        if (bare && bare === kk2) return f
      }
    }
  }
  return null
}

/* صف إعدادي معتمد من المفتاح المطبّع (أو null) */
function prepGradeCanonicalFromKey(key: string): string | null {
  if (!key) return null
  if (key === 'prep 1') return 'أولى إعدادي'
  if (key === 'prep 2') return 'تانية إعدادي'
  if (key === 'prep 3') return 'تالتة إعدادي'
  if (key.indexOf('اعدادي') === -1 && key.indexOf('اعدادى') === -1) return null
  if (/^(اولي|اول|الاولي|الاول)( |$)/.test(key)) return 'أولى إعدادي'
  if (/^(تانية|تانيه|ثانية|ثانيه|الثانية|الثانيه|الثاني)( |$)/.test(key)) return 'تانية إعدادي'
  if (/^(تالتة|تالت|تالته|ثالثة|ثالثه|ثالث|الثالثة|الثالثه|التالتة|التالته|التالت|الثالث)( |$)/.test(key)) return 'تالتة إعدادي'
  return null
}

/* أولى بكالوريا من المفتاح المطبّع — «أولى ثانوي/بكالوريا/1 Bac/...» (أو null).
   «أولى» لوحدها مبتتحدش عمدًا — ممكن تكون أولى إعدادي أو أولى بكالوريا. */
function secondaryGradeCanonicalFromKey(key: string): string | null {
  if (!key) return null
  var startsFirst = /^(اولي|اول|الاولي|الاول)( |$)/.test(key)
  if (key.indexOf('بكالوريا') !== -1) return startsFirst ? GRADE_S1 : null
  if (key.indexOf('ثانوي') !== -1 || key.indexOf('ثانوى') !== -1 || key.indexOf('ثانويه') !== -1) {
    return startsFirst ? GRADE_S1 : null
  }
  if (key === 'first secondary' || key === 'first secondary grade' || key === 'secondary 1' || key === '1 bac' || key === 'grade 10' || key === 'baccalaureate 1') return GRADE_S1
  return null
}

/* ------------------------------------------------------------
   تطبيع اسم الصف — الاسم المعتمد:
   • كل صيغ صفوف الابتدائي (السادس/سادس/grade 6/الصف السادسة الابتدائي/...)
     → «الصف السادس الابتدائي» (أو عيلة الصف المعنية) بالاسم الكامل
   • كل صيغ الإعدادي (الصف الأول الإعدادي/اولي اعدادي/...) → «أولى إعدادي»...
   • كل صيغ أولى ثانوي/بكالوريا → «أولى بكالوريا»
   ------------------------------------------------------------ */
export function normalizeGrade(grade: string): string {
  if (!grade) return ''
  var raw = String(grade).trim()
  if (!raw) return ''
  /* عائلات الابتدائي الأول — كل الصيغ → الاسم المعتمد الكامل */
  var primary = primaryGradeCanonical(raw)
  if (primary) return primary.ar
  var key = gradeKey(raw)
  var prep = prepGradeCanonicalFromKey(key)
  if (prep) return prep
  var sec = secondaryGradeCanonicalFromKey(key)
  if (sec) return sec
  /* الصيغ المطبّعة القديمة — نفس منطق النسخ المحلية القديمة بس من غير
     تقطيع includes لأسماء الابتدائي (المكسب الأساسي للتوحيد) */
  var g = raw.replace(/^الصف\s+/i, '')
  g = g.replace(/الاعدادي/gi, 'إعدادي')
  g = g.replace(/الإعدادي/gi, 'إعدادي')
  if (g.includes('أولى') || g.includes('اولى') || g.includes('الأول') || g.includes('الاول')) g = 'أولى'
  if (g.includes('تانية') || g.includes('الثاني') || g.includes('ثانية')) g = 'تانية'
  if (g.includes('تالتة') || g.includes('الثالث') || g.includes('ثالثة')) g = 'تالتة'
  if (g === 'أولى' && raw.includes('عداد')) g = 'أولى إعدادي'
  if (g === 'تانية' && raw.includes('عداد')) g = 'تانية إعدادي'
  if (g === 'تالتة' && raw.includes('عداد')) g = 'تالتة إعدادي'
  if (g === 'أولى' && (raw.includes('كالور') || raw.includes('ثانوي') || raw.includes('ثانوى'))) g = GRADE_S1
  /* ثانية/تالتة ثانوي — ممنوع التقطيع يضيّع كلمة «ثانوي» (صف ممكن المستر يضيفه) */
  if (g === 'تانية' && (raw.includes('ثانوي') || raw.includes('ثانوى'))) g = 'تانية ثانوي'
  if (g === 'تالتة' && (raw.includes('ثانوي') || raw.includes('ثانوى'))) g = 'تالتة ثانوي'
  return g
}

/* فلتر Prisma للقراءة: بيجيب كل صيغ نفس الصف مع بعض */
export function gradeWhere(grade: string): string | { in: string[] } {
  var vs = gradeVariants(grade)
  if (vs.length === 0) return normalizeGrade(grade)
  if (vs.length === 1) return vs[0]
  return { in: vs }
}

/* ------------------------------------------------------------
   كل الصيغ المخزنة اللي تعني نفس الصف — مطابقة **تساوي حرفية** على
   القايمة دي مكان خدعة contains بأول كلمة. للصف المعتمد: الاسم الكامل
   + كل المفاتيح + الصيغ القصيرة القديمة (السادس/سادسة/خامس/...) —
   عشان أي اسم اتخزن قبل التوحيد يظل يطابق، وعمرها ما تطابق صف تاني.
   ------------------------------------------------------------ */
export function gradeVariants(grade: string): string[] {
  var g = String(grade || '').trim()
  var n = normalizeGrade(g)
  var out: string[] = []
  if (g) out.push(g) // الصيغة الخام زي ما بعتها الطلب
  if (n) out.push(n) // الصيغة المطبعة الرسمية
  var fam = primaryGradeCanonical(g) || primaryGradeCanonical(n)
  if (fam) {
    out.push(fam.ar) // الاسم المعتمد الكامل
    for (var k = 0; k < fam.keys.length; k++) {
      var kk = String(fam.keys[k] || '').trim()
      if (kk) out.push(kk)
      var kb = stripBare(gradeKey(kk))
      if (kb) {
        out.push(kb)        // «سادس» / «خمسة» ...
        out.push('ال' + kb) // «السادس» / «الخمسة» — صيغ التقطيع القديمة
      }
    }
    /* الصيغة الكاملة ببادئة «الصف» — للعائلات اللي اسمها المعتمد من غيرها */
    if (fam.ar.indexOf('الصف ') !== 0) out.push('الصف ' + fam.ar)
    /* صيغة التاء المربوطة القديمة «الصف السادسة الابتدائي» — نفس الصف */
    var femBase = fam.ar.indexOf('الصف ') === 0 ? fam.ar : 'الصف ' + fam.ar
    out.push(femBase.replace('سادس الابتدائي', 'سادسة الابتدائي').replace('رابع الابتدائي', 'رابعة الابتدائي').replace('خامس الابتدائي', 'خامسة الابتدائي'))
    /* صيغ «الابتدائي» بالألف المقصورة (السادس الابتدائى) — التوأم الإملائي تحت بياخدها */
  }
  var target = n || g
  var key = gradeKey(target)
  var prep = prepGradeCanonicalFromKey(key)
  if (prep) {
    /* صيغ الإعدادي الكاملة القديمة: الصف الأول الإعدادي / الأول الإعدادي / أولي إعدادي... */
    var firstWordMap: Record<string, string[]> = {
      'أولى إعدادي': ['الأول الإعدادي'],
      'تانية إعدادي': ['الثاني الإعدادي'],
      'تالتة إعدادي': ['الثالث الإعدادي'],
    }
    var extras = firstWordMap[prep] || []
    for (var e = 0; e < extras.length; e++) {
      out.push(extras[e])
      out.push('الصف ' + extras[e])
    }
    out.push(prep.replace('أولى', 'أولي').replace('تانية', 'تانيه').replace('تالتة', 'تالته'))
  }
  var sec2 = secondaryGradeCanonicalFromKey(key)
  if (sec2) {
    /* صيغ أولى ثانوي/بكالوريا القديمة كلها — نفس الصف بالظبط */
    out.push(GRADE_S1_LEGACY)           // «أولى ثانوي»
    out.push('أولى ثانوى')              // بالألف المقصورة
    out.push('أولي ثانوي')
    out.push('الأول الثانوي')
    out.push('الصف الأول الثانوي')
    out.push('الصف الأول بكالوريا')
    out.push('الأول بكالوريا')
    out.push('أولي بكالوريا')
    out.push('first secondary')
  }
  /* توأم إملائي محدود — بتتباين في الهمزة/الى/هـ-ة بس، ممنوع استبدال عميق */
  var twin = function (v: string): string {
    return String(v || '')
      .replace('ثانوي', 'ثانوى').replace('إعدادي', 'إعدادى').replace('الاعدادي', 'الاعدادى')
      .replace(/أ/g, 'ا').replace(/إ/g, 'ا').replace(/ى/g, 'ي')
  }
  var twin2 = function (v: string): string {
    return String(v || '').replace(/ة/g, 'ه')
  }
  var arr = out.slice()
  for (var i = 0; i < arr.length; i++) {
    var t = twin(arr[i]); if (t && t !== arr[i]) out.push(t)
    var t2 = twin2(arr[i]); if (t2 && t2 !== arr[i]) out.push(t2)
  }
  var seen: Record<string, boolean> = {}
  var res: string[] = []
  for (var j = 0; j < out.length; j++) { var v = out[j]; if (v && !seen[v]) { seen[v] = true; res.push(v) } }
  return res
}

/* ------------------------------------------------------------
   أي اسم قديم في بيانات مخزنة بيرجع معروض بالاسم المعتمد الكامل —
   «السادس» بتظهر «الصف السادس الابتدائي» و«أولى ثانوي» بتظهر
   «أولى بكالوريا» في شارات الطلاب ولوحات الأدمن.
   ------------------------------------------------------------ */
export function displayGrade(grade?: string | null): string {
  var g = String(grade || '').trim()
  if (!g) return ''
  var fam = primaryGradeCanonical(g)
  if (fam) return fam.ar
  var key = gradeKey(g)
  var prep = prepGradeCanonicalFromKey(key)
  if (prep) return prep
  var sec = secondaryGradeCanonicalFromKey(key)
  if (sec) return sec
  return g
}

/* قيمة بتتخزن (كتابة جديدة دايمًا بالاسم المعتمد الكامل) */
export function storeGrade(grade?: string | null): string {
  var g = normalizeGrade(String(grade || ''))
  return g || String(grade || '')
}

/* ------------------------------------------------------------
   (S-4b) الاسم المعتمد لأي قيمة مخزنة قديمة — للترحيل في ensure-schema.
   بيرجع null لو القيمة مش من عيلة معروفة (بنسيبها زي ما هي —
   ممنوع نلمس أسماء صفوف مخصصة المستر مخترعها بنفسه).
   ------------------------------------------------------------ */
export function canonicalGradeName(name: any): string | null {
  var g = String(name || '').trim()
  if (!g) return null
  var fam = primaryGradeCanonical(g)
  if (fam) return fam.ar
  var key = gradeKey(g)
  var prep = prepGradeCanonicalFromKey(key)
  if (prep) return prep
  var sec = secondaryGradeCanonicalFromKey(key)
  if (sec) return sec
  return null
}
