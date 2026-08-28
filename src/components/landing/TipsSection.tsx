'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/stores/app-store'
import { Lightbulb, Clock, Brain, Pencil, MessageCircle, MapPin, Link2, BookOpen } from 'lucide-react'
import { useState, useEffect } from 'react'

var TIP_ICONS = [MapPin, Link2, BookOpen, Clock]
var TIP_COLORS = [
  'bg-[#0D9488]/10 text-[#0D9488] dark:bg-[#0D9488]/15 dark:text-[#5EEAD4]',
  'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  'bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
]

export default function TipsSection() {
  var { siteConfig, setSiteConfig, configLoaded } = useAppStore()

  var initialCfg = (typeof window !== 'undefined' && (window as any).__INITIAL_CONFIG__) || {}
  var cfg = configLoaded ? siteConfig : (Object.keys(siteConfig).length > 0 ? siteConfig : initialCfg)

  useEffect(function() {
    if (!configLoaded && Object.keys(siteConfig).length === 0) {
      fetch('/api/config')
        .then(function(r) { return r.json() })
        .then(function(data) {
          setSiteConfig(data)
          useAppStore.getState().setConfigLoaded(true)
        })
        .catch(function() {})
    }
  }, [configLoaded, siteConfig, setSiteConfig])

  var tipsBgImage = cfg.tips_bg_image || ''
  var tipsSectionImage = cfg.tips_section_image || ''
  var tipImages = [
    cfg.tip1_image || '',
    cfg.tip2_image || '',
    cfg.tip3_image || '',
  ]
  var [tipLoaded, setTipLoaded] = useState([false, false, false, false])
  var [bgLoaded, setBgLoaded] = useState(false)
  var [sectionImgLoaded, setSectionImgLoaded] = useState(false)

  var tips = [
    {
      icon: TIP_ICONS[0],
      titleAr: cfg.tips_card1_title || 'اربط الأحداث بالخريطة الزمنية',
      titleEn: cfg.tips_card1_title_en || 'Link Events to a Timeline',
      description: cfg.tips_card1_desc || 'حط كل حدث تاريخي على خريطة زمنية وشوف إزاي الأحداث متسلسلة ومترابطة. مثلاً: الحروب الصليبية سبّبت انتقال التجارة من البحر المتوسط إلى البحر الأحمر، وده أثّر على اقتصاد مصر والشام. لما بتيربط الأحداث ببعض، التاريخ بيبقى قصة واحدة مش حاجات منسية. Build a timeline and see how events connect sequentially.',
      color: TIP_COLORS[0],
    },
    {
      icon: TIP_ICONS[1],
      titleAr: cfg.tips_card2_title || 'ابحث عن السبب والنتيجة',
      titleEn: cfg.tips_card2_title_en || 'Find Cause & Effect',
      description: cfg.tips_card2_desc || 'كل حدث تاريخي ليه سبب ونتيجة. اسأل نفسك دايمًا: ليه حصل كده؟ وبعدها إيه اللي تغيّر؟ مثلاً: الثورة الفرنسية حصلت بسبب الأزمة الاقتصادية، ونتيجتها ظهور نابليون وتغيير خريطة أوروبا كلها. فهم السبب والنتيجة بيخلّي تحفظ القصة مش التفاصيل. Every event has a cause and consequence — understand the chain.',
      color: TIP_COLORS[1],
    },
    {
      icon: TIP_ICONS[2],
      titleAr: cfg.tips_card3_title || 'استخدم خرائط جغرافيا كدليل',
      titleEn: cfg.tips_card3_title_en || 'Use Maps as Your Guide',
      description: cfg.tips_card3_desc || 'التاريخ مرتبط بالجغرافيا ارتباط وثيق. لما تقرأ عن معركة أو غزو، افتح الخريطة وشوف الموقع الاستراتيجي. مثلاً: موقع مصر بين قارتين خلّاها محط اهتمام كل الإمبراطوريات من الفراعنة للإسلام للمملوك. فهم المكان بيساعدك تفهم إزاي الأحداث اتشكلت. History and geography are deeply connected — maps make it clear.',
      color: TIP_COLORS[2],
    },
    {
      icon: TIP_ICONS[3],
      titleAr: cfg.tips_card4_title || 'راجع بأسلوب السرد القصصي',
      titleEn: cfg.tips_card4_title_en || 'Review by Storytelling',
      description: cfg.tips_card4_desc || 'بعد ما تخلص درس، حاول تحكيه لحد تاني بأسلوبك. لما بتشرح الحدث بوصفك وكلامك، بتعيد ترتيب الأفكار في دماغك وتلاحظ فجوات فهمك. مثلاً: اروي قصة صلاح الدين من بداية نشأته لحد تحرير القدس — القصة بتثبّت المعلومة أحسن من أي حفظ. Tell the story in your own words to solidify understanding.',
      color: TIP_COLORS[3],
    },
  ]

  function renderTipCard(tip, idx) {
    return (
      <Card
        key={tip.titleEn}
        className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-border/50 bg-card"
      >
        <CardContent className="p-4 sm:p-5 flex gap-4 items-start">
          {tipImages[idx] ? (
            <div className="h-11 w-11 shrink-0 rounded-lg overflow-hidden border border-border/50 relative">
              {!tipLoaded[idx] && <div className="h-full w-full animate-pulse bg-secondary" />}
              <img
                src={tipImages[idx]}
                alt={tip.titleAr}
                className={"h-full w-full object-cover transition-opacity duration-300 " + (tipLoaded[idx] ? 'opacity-100' : 'opacity-0 absolute')}
                loading="eager"
                onLoad={function() { setTipLoaded(function(prev) { var n = [...prev]; n[idx] = true; return n }) }}
              />
            </div>
          ) : (
            <div
              className={"inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 " + tip.color}
            >
              <tip.icon className="h-5 w-5" />
            </div>
          )}
          <div className="space-y-1.5 min-w-0">
            <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug">
              <span className="block">{tip.titleAr}</span>
              <span className="block text-xs sm:text-sm text-muted-foreground font-normal mt-0.5">
                {tip.titleEn}
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {tip.description}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="py-16 sm:py-20 relative bg-background dark:bg-[#0C1220]" dir="rtl">
      {/* Background image */}
      {tipsBgImage && (
        <>
          {!bgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-secondary" />
          )}
          <img
            src={tipsBgImage}
            alt=""
            className={"absolute inset-0 w-full h-full object-cover -z-10 transition-opacity duration-500 " + (bgLoaded ? 'opacity-100' : 'opacity-0')}
            loading="eager"
            fetchPriority="high"
            onLoad={function() { setBgLoaded(true) }}
          />
          <div className="absolute inset-0 -z-10 bg-background/80 dark:bg-[#0C1220]/80" />
        </>
      )}

      <div className="mx-auto max-w-5xl px-4 sm:px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Lightbulb className="h-4 w-4" />
            <span>{cfg.tips_badge || 'نصائح تاريخية | History Tips'}</span>
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">
            {cfg.tips_title || 'نصائح مستر عمرو لفهم التاريخ | Mr. Amr\'s History Tips'}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            {cfg.tips_subtitle || 'نصائح ذهبية لتربط الأحداث التاريخية ببعض وتفهم القصة الكاملة ورا كل حدث — Golden advice to connect historical events and understand the full story'}
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 lg:gap-8 items-start">
          <div className="order-2 lg:order-2 space-y-4">
            {tips.map(function(tip, idx) {
              return renderTipCard(tip, idx)
            })}
          </div>

          {tipsSectionImage && (
            <div className="order-1 lg:order-1">
              <div className="lg:sticky lg:top-24 relative rounded-2xl overflow-hidden shadow-xl border border-border/20">
                {!sectionImgLoaded && (
                  <div className="w-full aspect-[3/4] animate-pulse bg-secondary" />
                )}
                <img
                  src={tipsSectionImage}
                  alt="نصائح مستر عمرو"
                  className={"w-full aspect-[3/4] object-cover transition-opacity duration-500 " + (sectionImgLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0')}
                  loading="eager"
                  onLoad={function() { setSectionImgLoaded(true) }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
