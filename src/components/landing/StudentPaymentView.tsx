'use client'
 
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight, Upload, Loader2, CheckCircle2,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Image from 'next/image'

// Payment logos - verified working URLs
var PAYMENT_LOGOS: Record<string, string> = {
  vodafone_cash: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/5440d09e8f1f.png',
  instapay: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/67eafd7722b0.png',
  fawry: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3b5ec9d6c766.png',
}

var PAYMENT_LABELS: Record<string, string> = {
  vodafone_cash: 'فودافون كاش',
  instapay: 'إنستا باي',
  fawry: 'فوري',
}

var PAYMENT_METHODS_ORDER = ['vodafone_cash', 'instapay', 'fawry']

export function StudentPaymentView() {
  const { pendingPaymentVideo, setView, setPendingPaymentVideo, siteConfig } = useAppStore()
  const [paymentMethod, setPaymentMethod] = useState('vodafone_cash')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const video = pendingPaymentVideo

  // Payment numbers from site config (set by admin)
  var vodafoneCash = siteConfig?.payment_vodafone_cash || ''
  var instapay = siteConfig?.payment_instapay || ''
  var fawry = siteConfig?.payment_fawry || ''

  // Map method key to its number
  var getPaymentNumber = function(method: string) {
    if (method === 'vodafone_cash') return vodafoneCash
    if (method === 'instapay') return instapay
    if (method === 'fawry') return fawry
    return ''
  }

  // Get available methods based on config
  var availableMethods = PAYMENT_METHODS_ORDER.filter(function(m) {
    return !!getPaymentNumber(m)
  })

  // Default to first available method
  useEffect(function() {
    if (availableMethods.length > 0 && !availableMethods.includes(paymentMethod)) {
      setPaymentMethod(availableMethods[0])
    }
  }, [availableMethods])

  useEffect(() => {
    if (!video) {
      setView('student-portal')
    }
  }, [video, setView])

  if (!video) return null

  var currentNumber = getPaymentNumber(paymentMethod)

  const handleSubmit = async () => {
    if (!paymentMethod || !receiptFile) {
      toast.error('اختر طريقة الدفع وارفع الإيصال')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('videoId', video.id)
      formData.append('videoTitle', video.title)
      formData.append('amount', String(video.price))
      formData.append('paymentMethod', paymentMethod)
      formData.append('receipt', receiptFile)

      const res = await fetch('/api/payments', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setSubmitted(true)
        toast.success('تم إرسال إيصال الدفع بنجاح! سيتم مراجعته قريباً')
      } else {
        toast.error('حدث خطأ أثناء إرسال الدفع')
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setUploading(false)
    }
  }

  const handleBack = () => {
    setPendingPaymentVideo(null)
    setView('student-portal')
  }

  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8 space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold">تم إرسال الإيصال بنجاح!</h2>
            <p className="text-muted-foreground">
              سيتم مراجعة الدفع وتشغيل الفيديو في أقرب وقت.
            </p>
            <Button onClick={handleBack} className="mt-4">
              <ArrowRight className="h-4 w-4 ml-2" />
              العودة للدروس
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowRight className="h-4 w-4 ml-1" />
            رجوع
          </Button>
          <h1 className="text-xl font-bold">الدفع</h1>
        </div>

        {/* Video Info */}
        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">فيديو</p>
              <p className="font-bold truncate">{video.title}</p>
            </div>
            <Badge className="text-lg px-3 py-1 bg-amber-500 text-white shrink-0">
              {video.price} ج.م
            </Badge>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-bold">اختر طريقة الدفع</h2>

            {/* Method Buttons with Logos - 3 columns */}
            <div className="grid grid-cols-3 gap-2">
              {availableMethods.map(function(method) {
                var isActive = paymentMethod === method
                var logoUrl = PAYMENT_LOGOS[method]
                var label = PAYMENT_LABELS[method]
                return (
                  <button
                    key={method}
                    onClick={function() { setPaymentMethod(method) }}
                    className={"flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all " + (
                      isActive
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-primary/50"
                    )}
                  >
                    <div className="h-7 w-14 relative flex items-center justify-center">
                      <Image
                        src={logoUrl}
                        alt={label}
                        width={56}
                        height={28}
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    <span className="text-[11px] font-medium leading-tight text-center">{label}</span>
                  </button>
                )
              })}
            </div>

            {/* Selected Method Details - show by default */}
            {currentNumber ? (
              <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                <p className="text-xs text-muted-foreground">احول المبلغ على الرقم ده:</p>
                <p className="text-xl font-bold tracking-wider" dir="ltr">{currentNumber}</p>
                <p className="text-xs text-muted-foreground">{PAYMENT_LABELS[paymentMethod]}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Receipt Upload */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-bold">ارفع إيصال الدفع</h2>
            <label className={"flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors " + (
              receiptFile ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
            )}>
              {receiptFile ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                  <p className="text-sm font-medium text-primary">{receiptFile.name}</p>
                  <p className="text-xs text-muted-foreground">اضغط لتغيير الصورة</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">اضغط لاختيار صورة الإيصال</p>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              />
            </label>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          className="w-full py-6 text-base"
          size="lg"
          onClick={handleSubmit}
          disabled={!paymentMethod || !receiptFile || uploading}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin ml-2" />
          ) : (
            <CheckCircle2 className="h-5 w-5 ml-2" />
          )}
          {uploading ? 'جاري الإرسال...' : 'إرسال الإيصال'}
        </Button>
      </div>
    </div>
  )
}
