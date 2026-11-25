'use client'
// ============================================================
// DevToolsGuard — فخ الفيديو + أدوات المطوّر (ر5 — طلب المستر الحرفي)
// ============================================================
// «انا عاوز اي حد يفتح الفيديو — سواء من التلات نقط أو الفيديو يفتح
//  ذات نفسه — 10 ثواني بالعد التنازلي 10 9 8... لو ما قفلش الإشعار
//  حسابه هيترفض من المنصة تماما ومش هيقدر يدخل على المنصة تاني.
//  واي حد يفتح الـ Developer Tools وهو جايب الفيديو — شاشة المنصة
//  تقلب سودة أول ما يفتح الأدوات، بنفس التحذير: إلا هتخرج من المنصة.»
//
// القواعد (نظام واحد بمهلة 10 ثواني على ساعة الحائط):
//   1) فيديو مفتوح لطالب مسجل → إشعار تحذير علوي + عد 10→1 —
//      قفل الفيديو قبل الصفر = المسامحة، الإشعار بيروح وبيكمل عادي.
//   2) أدوات المطوّر مفتوحة → شاشة سودة فورية + عد 10→1 —
//      قفل الأدوات قبل الصفر = مسامحة.
//   3) الاتنين مع بعض → سودة فورية أول ما الأدوات تتفتح، والعد
//      بيتبدأ من 10 مرة واحدة (فتح/قفل متكرر للأدوات ما بيصفرش
//      العد — يُملي اللعبة). المسامحة = قفل الأدوات **والفيديو**.
//   4) عند الصفر → POST /api/security/reject-student (محمي ببصمة
//      جهاز الحساب) → الحساب يترفض نهائيًا (status=rejected) ومش
//      بيدخل تاني — والمستر بس اللي يقدر يعيد تفعيله من لوحة الأدمن.
//   5) طبقة السيرفر الصارمة: /api/video-ticket بيسجل كل فتح فيديو
//      في VideoOpenLog — أي فتح عالق أكتر من 60 ثانية = رفض من
//      السيرفر حتى لو الطالب حجب طلبات المنصة من الـ Network.
//   6) المهلة بتعد على **ساعة الحائط** (Date.now) مش عدّاد تيك —
//      يعني تجميد الصفحة من الـ debugger ما بيوقفش العد ولا بيمددها:
//      أول ما الصفحة تفضلش بتحصل على نفسها، العد بيتلاقى منتهي فورًا.
//   7) الأدمن مستثنى تمامًا (المستر يفتح أدوات المطوّر براحته).
//
// الكشف (3 إشارات مستقلة — درس 2026-ز11: الزووم مضبوط بالكامل):
//   أ) فجوة مقاس النافذة مع تعقيم الزووم: زووم المتصفح بيغير
//      devicePixelRatio — أي تغيير dpr = زووم/سيلينج نظام (بنجلّد
//      المرجع benign) — فتح أدوات مطوّرة مثبتة بيكبر الفجوة من غير
//      أي تغيير dpr = إشارة. (درس الزووم 125%/150% والسايدبارات).
//   ب) توقيت جملة debugger (من الحارس القديم ز19) — الأدوات مفتوحة
//      والـ breakpoints شغالة = التنفيذ بيفصل عند الجملة.
//   ج) فخ الكونسول: object بخاصية getter بنسجله كل ثانيتين —
//      الكونسول لما يعرضه بيشغّل الـ getter حتى لو الأدوات فاتحة
//      في نافذة منفصلة (undocked).
//   د) صدمة البلاغات المتأخرة: مشغّل الفيديو المحمي بيبعت بلاغ
//      التقدم mg_vp بطابع زمني كل 5 ثواني — لو بلاغ وصل متأخر عن
//      طابعه أكتر من 10 ثواني = الصفحة كانت مجمّدة (خدعة إيقاف
//      الـ debugger عشان يشوف الفيديو في الـ iframe بس) → إشارة.
// ============================================================
import { useEffect } from 'react'
import { getDeviceCandidates, getDeviceId } from '@/lib/device'

const LOCK_KEY = 'dv_guard_locked'
/* (ر6) مهلة العدّ من إعدادات الأدمن — طلب المستر الحرفي: «المهلة 8 ثواني بدل 10
   والمهلة أقدر أتحكم فيها من صفحة الأدمن» — مفتاح guard_countdown_seconds
   في site-config، افتراضي 8 ثواني ويقبل من 3 لـ 120 */
const GUARD_COUNTDOWN_KEY = 'guard_countdown_seconds'
const GUARD_COUNTDOWN_DEFAULT = 8
const Z_GAP = 170

export function DevToolsGuard() {
  useEffect(function () {
    if (typeof window === 'undefined') return

    /* الأدمن مستثنى — أي مفتاح جلسة فيه كلمة admin = مش هنشغّل الحارس */
    try {
      for (var li = 0; li < localStorage.length; li++) {
        var lk = localStorage.key(li) || ''
        if (/admin/i.test(lk)) return
      }
    } catch (e) {}

    /* تاب متقفل نهائي (مهلة خلصت قبل كده في نفس التاب) */
    try {
      var lockedVal = sessionStorage.getItem(LOCK_KEY) || ''
      if (lockedVal === 'rejected') { renderFinal('rejected'); return }
      if (lockedVal === '1') { renderFinal('locked'); return }
    } catch (e) {}

    /* ===== الحالة ===== */
    var done = false
    var running = false
    var videoOpen = false
    var dtOpen = false
    var mode: '' | 'warn' | 'black' = ''
    var deadline = 0
    var dtGraceUsed = false
    var lastShown = -1
    /* (ر6) المهلة القابلة للتحكم من الأدمن — بتتقرا من site-config أول ما الحارس يشتغل */
    var countMs = GUARD_COUNTDOWN_DEFAULT * 1000
    var armedDurMs = 0
    try {
      fetch('/api/site-config')
        .then(function (r) { return r.json() })
        .then(function (arr: any) {
          if (!Array.isArray(arr)) return
          for (var i = 0; i < arr.length; i++) {
            var c = arr[i]
            if (c && c.key === GUARD_COUNTDOWN_KEY && c.value !== '' && c.value != null) {
              var n = parseInt(String(c.value), 10)
              if (isNaN(n)) return
              if (n < 3) n = 3
              if (n > 120) n = 120
              countMs = n * 1000
            }
          }
        })
        .catch(function () {})
    } catch (e) {}

    /* إشارات أدوات المطوّر */
    var dpr0 = (window.devicePixelRatio as number) || 1
    var gap0 = (window.outerWidth || 0) - (window.innerWidth || 0)
    var sizePos = 0
    var dbgPos = 0
    var cleanStreak = 0
    var lastGetterHit = 0
    var lastStaleHit = 0
    var tickNo = 0

    /* ===== جلسة الطالب ===== */
    function readStudent(): { id: string } | null {
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i) || ''
          if (/admin/i.test(k)) continue
          if (k === 'ln' || /student/i.test(k)) {
            var raw = localStorage.getItem(k) || ''
            if (raw && raw.charAt(0) === '{') {
              var o = JSON.parse(raw)
              if (o && o.id) return { id: String(o.id) }
            }
          }
        }
      } catch (e) {}
      return null
    }

    function clearSessions() {
      try {
        var kill: string[] = []
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i) || ''
          if (k === 'ln' || /student|parent/i.test(k)) kill.push(k)
        }
        for (var j = 0; j < kill.length; j++) localStorage.removeItem(kill[j])
      } catch (e) {}
    }

    /* ===== إشارات الكشف ===== */
    function sizeSignal(): boolean {
      try {
        var dpr = (window.devicePixelRatio as number) || 1
        if (Math.abs(dpr - dpr0) > 0.015) {
          /* زووم متصفح أو تغيير سيلينج النظام — benign: بنعيد ضبط المرجع */
          dpr0 = dpr
          gap0 = (window.outerWidth || 0) - (window.innerWidth || 0)
          sizePos = 0
          return false
        }
        var gap = (window.outerWidth || 0) - (window.innerWidth || 0)
        return gap - gap0 > Z_GAP
      } catch (e) { return false }
    }

    function dbgSignal(): boolean {
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now()
      try {
        /* جملة debugger داخل دالة متولدة — لو الأدوات مفتوحة والـ
           breakpoints شغالة التنفيذ بيفصل عندها والوقت بيقفز */
        (function () {} as any).constructor('debugger')()
      } catch (e) {}
      var dt = ((window.performance && performance.now) ? performance.now() : Date.now()) - t0
      return dt > 50
    }

    /* فخ الكونسول — getter بيتشغل لما الكونسول يعرض الـ object */
    var trapObj: any = {}
    try {
      Object.defineProperty(trapObj, 'id', {
        get: function () { lastGetterHit = Date.now(); return '' },
        configurable: true,
      })
    } catch (e) {}

    /* بلاغات المشغل المتأخرة = الصفحة كانت مجمّدة */
    function onPlayerMessage(ev: MessageEvent) {
      try {
        var d: any = ev && ev.data
        if (!d || typeof d !== 'object') return
        if (d.type === 'mg_vp' && d.tm) {
          if (Date.now() - Number(d.tm) > 10000) lastStaleHit = Date.now()
        }
      } catch (e) {}
    }

    /* ===== أحداث فتح/قفل الفيديو (من SecurePlayerModal) ===== */
    function onVideoOpen() {
      if (done || videoOpen) return
      videoOpen = true
      recompute()
    }
    function onVideoClose() {
      if (done) return
      videoOpen = false
      recompute()
    }
    try {
      window.addEventListener('vtrap-open', onVideoOpen as EventListener)
      window.addEventListener('vtrap-close', onVideoClose as EventListener)
      window.addEventListener('message', onPlayerMessage as EventListener)
      window.addEventListener('resize', onResizeEvt as EventListener)
    } catch (e) {}
    function onResizeEvt() { if (!done) tickBody() }

    /* ===== آلة الحالة ===== */
    function recompute() {
      if (done) return
      var armed = videoOpen || dtOpen
      if (!armed) {
        if (running) {
          /* المسامحة — كل المصادر اتقفلت قبل الصفر: الاشعار بيروح وبيكمل */
          running = false
          deadline = 0
          dtGraceUsed = false
          mode = ''
          removeUI()
        }
        return
      }
      if (!running) {
        running = true
        deadline = Date.now() + countMs
        armedDurMs = countMs
        dtGraceUsed = !!dtOpen
        mode = dtOpen ? 'black' : 'warn'
        renderMode()
        lastShown = -1
        paintCount()
      } else if (dtOpen && mode !== 'black') {
        mode = 'black'
        if (!dtGraceUsed) { deadline = Date.now() + countMs; armedDurMs = countMs; dtGraceUsed = true }
        renderMode()
        lastShown = -1
        paintCount()
      } else if (!dtOpen && mode === 'black' && videoOpen) {
        mode = 'warn'
        renderMode()
        lastShown = -1
        paintCount()
      }
    }

    /* ===== حلقة التشغيل (500ms) ===== */
    var timer = setInterval(tickBody, 500)

    function tickBody() {
      if (done) return
      tickNo++

      if (tickNo % 2 === 0) { if (dbgSignal()) { dbgPos++; cleanStreak = 0 } else { dbgPos = 0; cleanStreak++ } }
      if (sizeSignal()) { sizePos++; cleanStreak = 0 } else { sizePos = 0; cleanStreak++ }

      /* فخ الكونسول — لما الفيديو مفتوح أو الحارس شغال بس.
         لازم log عادي من غير %c عشان الكونسول يعرض الـ object
         ويشغّل الـ getter */
      if ((videoOpen || running) && tickNo % 4 === 0) {
        try { console.log(trapObj) } catch (e) {}
      }

      var getterFresh = (Date.now() - lastGetterHit) < 3000
      var staleFresh = (Date.now() - lastStaleHit) < 5000
      var pos = sizePos >= 2 || dbgPos >= 2 || getterFresh || staleFresh

      if (pos) {
        cleanStreak = 0
        if (!dtOpen) { dtOpen = true; recompute() }
      } else if (dtOpen && cleanStreak >= 6) {
        dtOpen = false
        recompute()
      }

      recompute()

      if (running) {
        paintCount()
        /* لو حد شال العنصر نفسه من الـ DOM بالأدوات — بنرجّعه فورًا */
        if (mode === 'black' && !document.getElementById('vtrap-black')) renderMode()
        if (mode === 'warn' && !document.getElementById('vtrap-warn')) renderMode()
        var leftMs = deadline - Date.now()
        if (leftMs <= 0) { punish(); return }
      }
    }

    /* ===== الرسم ===== */
    var numBlack: HTMLElement | null = null
    var barBlack: HTMLElement | null = null
    var numWarn: HTMLElement | null = null

    function secsLeft(): number {
      return Math.ceil((deadline - Date.now()) / 1000)
    }

    function paintCount() {
      if (!running || done) return
      var left = secsLeft()
      if (left === lastShown) return
      lastShown = left
      if (left < 0) left = 0
      if (numBlack) numBlack.textContent = String(left)
      if (barBlack) barBlack.style.width = Math.max(0, armedDurMs > 0 ? Math.min(100, (left * 1000) / armedDurMs * 100) : 0) + '%'
      if (numWarn) numWarn.textContent = String(left)
    }

    function removeUI() {
      try {
        var w = document.getElementById('vtrap-warn')
        if (w && w.parentNode) w.parentNode.removeChild(w)
        var b = document.getElementById('vtrap-black')
        if (b && b.parentNode) b.parentNode.removeChild(b)
      } catch (e) {}
      numBlack = null; barBlack = null; numWarn = null
    }

    function baseStyles(): string {
      return 'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center;direction:rtl;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;text-align:center;padding:24px'
    }

    function renderMode() {
      removeUI()
      /* (ر6) الثواني المعروضة من المهلة القابلة للتحكم من الأدمن */
      var secs = Math.max(1, Math.round(countMs / 1000))
      if (mode === 'black') {
        var o = document.createElement('div')
        o.id = 'vtrap-black'
        o.setAttribute('role', 'alert')
        o.setAttribute('aria-live', 'assertive')
        o.style.cssText = baseStyles()
        o.innerHTML =
          '<div style="max-width:560px;display:flex;flex-direction:column;align-items:center;gap:16px">' +
          '<div style="font-size:60px;line-height:1">🛡️</div>' +
          '<div style="font-size:24px;font-weight:900;letter-spacing:.5px">أدوات المطوّر ممنوعة على المنصة</div>' +
          '<div style="font-size:15px;color:#d4d4d8;line-height:1.9">عندك <b style="color:#fbbf24">' + secs + ' ثواني</b> بس — اقفل أدوات المطوّر والفيديو فورًا<br/>' +
          '<b style="color:#f87171">إلا هتخرج من المنصة وحسابك هيترفض نهائيًا</b> ومش هتقدر تدخل تاني</div>' +
          '<div id="vtrap-num-b" style="font-size:92px;font-weight:900;color:#f87171;font-variant-numeric:tabular-nums;line-height:1">' + secs + '</div>' +
          '<div style="width:100%;max-width:340px;height:8px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden">' +
          '<div id="vtrap-bar" style="height:100%;width:100%;background:#f87171;border-radius:99px;transition:width .5s linear"></div>' +
          '</div>' +
          '<div style="font-size:12px;color:#71717a">المنصة بتحمي مجهود المستر وحق الطلاب اللي دفعوا</div>' +
          '</div>'
        document.body.appendChild(o)
        try { document.body.style.overflow = 'hidden' } catch (e) {}
        numBlack = o.querySelector('#vtrap-num-b')
        barBlack = o.querySelector('#vtrap-bar')
      } else if (mode === 'warn') {
        var w = document.createElement('div')
        w.id = 'vtrap-warn'
        w.setAttribute('role', 'alert')
        w.style.cssText =
          'position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#9f1239;color:#fff;' +
          'direction:rtl;font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:10px 16px;' +
          'display:flex;align-items:center;justify-content:center;gap:14px;box-shadow:0 8px 24px rgba(0,0,0,.35)'
        w.innerHTML =
          '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center">' +
          '<div style="font-size:15px;font-weight:900">⚠️ الفيديوهات ممنوعة على المنصة — اقفل الفيديو فورًا</div>' +
          '<div style="font-size:12px;color:#fecdd3;line-height:1.7">عندك ' + secs + ' ثواني — إلا ما قفلتش الفيديو <b style="color:#fff">حسابك هيترفض من المنصة نهائيًا</b></div>' +
          '</div>' +
          '<div id="vtrap-num-w" style="font-size:40px;font-weight:900;color:#fecdd3;font-variant-numeric:tabular-nums;line-height:1;min-width:56px">' + secs + '</div>'
        document.body.appendChild(w)
        numWarn = w.querySelector('#vtrap-num-w')
      }
    }

    function renderFinal(kind: 'rejected' | 'locked') {
      done = true
      running = false
      removeUI()
      try { document.body.style.overflow = 'hidden' } catch (e) {}
      var o = document.getElementById('vtrap-final') as HTMLElement | null
      if (!o) {
        o = document.createElement('div')
        o.id = 'vtrap-final'
        o.setAttribute('role', 'alert')
        o.style.cssText = baseStyles()
        document.body.appendChild(o)
      }
      o.innerHTML =
        '<div style="max-width:560px;display:flex;flex-direction:column;align-items:center;gap:16px">' +
        '<div style="font-size:64px;line-height:1">' + (kind === 'rejected' ? '🚫' : '🛡️') + '</div>' +
        (kind === 'rejected'
          ? '<div style="font-size:28px;font-weight:900">حسابك مرفوض من المنصة</div>' +
            '<div style="font-size:14px;color:#d4d4d8;line-height:1.9">اتقفل كل حاجة — مش هتقدر تدخل على المنصة تاني<br/>إلا لما المستر يعيد تفعيل حسابك من لوحة التحكم.<br/><b style="color:#fbbf24">لو ده حصل بالغلط — كلم المستر وهو هيرجّعك.</b></div>'
          : '<div style="font-size:26px;font-weight:900">اتقفل الدخول للمنصة</div>' +
            '<div style="font-size:14px;color:#d4d4d8;line-height:1.9">أدوات المطوّر ممنوعة تمامًا على المنصة.</div>') +
        '</div>'
    }

    /* ===== العقوبة: الرفض النهائي (مش مسح — المستر يقدر يرجّعه) ===== */
    function punish() {
      if (done) return
      done = true
      running = false
      removeUI()
      try { clearInterval(timer) } catch (e) {}
      var st = readStudent()
      if (st && st.id) {
        try { sessionStorage.setItem(LOCK_KEY, 'rejected') } catch (e) {}
        renderFinal('rejected')
        var payload: any = { studentId: st.id, reason: 'devtools' }
        try {
          payload.deviceId = getDeviceId()
          payload.candidates = getDeviceCandidates()
        } catch (e) {}
        try {
          fetch('/api/security/reject-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(function () {})
        } catch (e) {}
        setTimeout(function () {
          try { clearSessions() } catch (e) {}
          try { location.replace('/') } catch (e) {}
        }, 900)
      } else {
        try { sessionStorage.setItem(LOCK_KEY, '1') } catch (e) {}
        clearSessions()
        renderFinal('locked')
      }
    }

    /* بداية نظيفة */
    return function cleanup() {
      try {
        clearInterval(timer)
        window.removeEventListener('vtrap-open', onVideoOpen as EventListener)
        window.removeEventListener('vtrap-close', onVideoClose as EventListener)
        window.removeEventListener('message', onPlayerMessage as EventListener)
        window.removeEventListener('resize', onResizeEvt as EventListener)
      } catch (e) {}
    }
  }, [])
  return null
}
