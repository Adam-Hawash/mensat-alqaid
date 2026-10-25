'use client'

// ============================================================
// (2026-Z32) زرار تثبيت المنصة كتطبيق — نفس نظام Maths-Genius بالظبط
// (المنطق النهائي و110 هناك): الزرار ظاهر دايمًا في كل الحالات
// من غير أي استثناء (لا localStorage ولا standalone بيخفياه).
// الضغطة عليه:
//   1) المتصفح جاهز للتثبيت → نافذة التثبيت الرسمية فورًا — تدوس تثبيت وخلاص
//   2) التطبيق متثبت فعلًا على الجهاز → رسالة «مثبت بالفعل» (بدل كلام فاضي)
//   3) غير كده (آيفون/متصفح مؤجل) → تعليمات قصيرة خطوة بخطوة
// ============================================================
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Smartphone, X, Download } from 'lucide-react'
import { toast } from 'sonner'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/* منطق التثبيت المشترك — نفس الحالة للأزرار كلها (الهيدر/القايمة/العايم) */
function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIos, setIsIos] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [showHint, setShowHint] = useState(false)

  useEffect(function () {
    var alone = false
    try {
      alone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    } catch (e) {}
    setStandalone(alone)
    var ua = String(window.navigator.userAgent || '')
    setIsIos(/iphone|ipad|ipod/i.test(ua))
    var handler = function (e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return function () {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  var alreadyInstalledToast = function () {
    toast.success('التطبيق مثبت عندك بالفعل ✅', {
      description: 'افتح المنصة من أيقونة التطبيق على شاشتك',
    })
  }

  var install = async function () {
    /* 1) المتصفح جاهز → نافذة التثبيت الرسمية فورًا — من غير أي خطوات يدوية */
    if (deferred) {
      try {
        toast.info('تثبيت التطبيق — بنفتحلك نافذة التثبيت…', {
          description: 'دوس تثبيت / Install وأيقونة التطبيق هتنزل على شاشتك',
        })
        await deferred.prompt()
        var choice = await deferred.userChoice
        if (choice.outcome === 'accepted') {
          toast.success('تم تثبيت التطبيق بنجاح 🎉', {
            description: 'افتح المنصة من أيقونة التطبيق — شاشة كاملة من غير متصفح',
          })
        }
      } catch (e) {}
      return
    }
    /* 2) التطبيق متثبت فعلًا (WebAPK/standalone) → رسالة واضحة بدل التعليمات */
    try {
      var nav = window.navigator as any
      if (typeof nav.getInstalledRelatedApps === 'function') {
        var related = await nav.getInstalledRelatedApps()
        if (related && related.length > 0) {
          alreadyInstalledToast()
          return
        }
      }
    } catch (e) {}
    if (standalone) {
      alreadyInstalledToast()
      return
    }
    /* 3) آخر حل — تعليمات قصيرة (آيفون أساسًا لأن أبل مش بتسمح بتثبيت تلقائي) */
    setShowHint(true)
  }

  return { isIos: isIos, standalone: standalone, showHint: showHint, setShowHint: setShowHint, install: install }
}

/* مودال التعليمات — بيظهر بس لما المتصفح مش قادر يفتح نافذة التثبيت بنفسه */
function InstallHintModal({ isIos, onClose }: { isIos: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-sm rounded-2xl border shadow-2xl p-5 space-y-3" onClick={function (e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between">
          <p className="font-bold text-sm">تثبيت التطبيق</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="إغلاق"><X className="h-4 w-4" /></button>
        </div>
        {isIos ? (
          <ol className="text-sm space-y-2 text-muted-foreground list-decimal pr-5">
            <li>افتح المنصة في Safari (لو فاتحها من كروم افتحها في Safari)</li>
            <li>دوس على زرار المشاركة <span className="font-bold text-foreground">⬆️</span> تحت في النص</li>
            <li>انزل تحت ودوس <span className="font-bold text-foreground">إضافة إلى الشاشة الرئيسية</span></li>
            <li>دوس <span className="font-bold text-foreground">إضافة</span> — والتطبيق هيظهر على شاشة الموبايل</li>
          </ol>
        ) : (
          <ol className="text-sm space-y-2 text-muted-foreground list-decimal pr-5">
            <li>دوس على قائمة المتصفح <span className="font-bold text-foreground">⋮</span> فوق جنب العنوان</li>
            <li>اختار <span className="font-bold text-foreground">تثبيت التطبيق</span> أو <span className="font-bold text-foreground">إضافة إلى الشاشة الرئيسية</span></li>
            <li>دوس <span className="font-bold text-foreground">تثبيت</span> — والتطبيق هيظهر على شاشتك</li>
          </ol>
        )}
        <p className="text-[11px] text-muted-foreground">بعد التثبيت افتح المنصة من أيقونة التطبيق مباشرة — شاشة كاملة من غير متصفح</p>
      </div>
    </div>
  )
}

/* زر عادي بيتركب في الهيدر/القايمة/بورتال الطالب — ظاهر دايمًا في كل الحالات */
export function InstallPwaButton({ variant = 'default', size, className = '', label }: { variant?: 'default' | 'outline' | 'ghost' | 'secondary'; size?: 'default' | 'sm' | 'lg' | 'icon'; className?: string; label?: string }) {
  var pwa = usePwaInstall()
  var finalLabel = label !== undefined && label !== null && label !== '' ? label : 'التطبيق'
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={pwa.install} aria-label="ثبّت المنصة كتطبيق على جهازك">
        <Smartphone className="h-4 w-4 ml-1.5" />
        <span>{finalLabel}</span>
      </Button>
      {pwa.showHint && <InstallHintModal isIos={pwa.isIos} onClose={function () { pwa.setShowHint(false) }} />}
    </>
  )
}

/* الزرار العايم الثابت — شمال تحت في كل الصفحات، ظاهر دايمًا */
export function FloatingInstallButton() {
  var pwa = usePwaInstall()
  return (
    <>
      <button
        onClick={pwa.install}
        aria-label="ثبّت المنصة كتطبيق على جهازك"
        className="fixed z-[90] left-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-xl border border-primary/30 pl-4 pr-3.5 min-h-[44px] font-bold text-sm hover:shadow-2xl hover:scale-[1.04] active:scale-95 transition-all"
      >
        <Download className="h-4 w-4 animate-pulse" />
        ثبّت التطبيق
      </button>
      {pwa.showHint && <InstallHintModal isIos={pwa.isIos} onClose={function () { pwa.setShowHint(false) }} />}
    </>
  )
}
