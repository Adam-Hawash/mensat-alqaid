'use client'

import { useAppStore } from '@/stores/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Video, Users, BookOpen, MonitorSmartphone, HeadphonesIcon, MessageCircle, Star, Target, Zap, Award, Sparkles, TrendingUp } from 'lucide-react'

// (و78) بول الأيقونات والألوان للمميزات المضافة ديناميكيًا — بيلف بالدور (i % length)
const FEATURE_ICONS = [Video, Users, BookOpen, MonitorSmartphone, HeadphonesIcon, MessageCircle, Star, Target, Zap, Award, Sparkles, TrendingUp]
const FEATURE_COLORS = [
  'bg-[#0D9488]/10 text-[#0D9488] dark:bg-[#0D9488]/15 dark:text-[#5EEAD4]',
  'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  'bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  'bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
  'bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-400',
]

export function FeaturesSection() {
  const { siteConfig } = useAppStore()
  const cfg = siteConfig

  const features = [
    {
      icon: Video,
      title: cfg.feature1_title || 'حصص مباشرة على Zoom',
      description: cfg.feature1_desc || 'حصص تفاعلية مباشرة مع مستر عمرو رشدي. اسأل واستفهم لحظة بلحظة، وشارك في مناقشات مع زملائك.',
      color: 'bg-[#0D9488]/10 text-[#0D9488] dark:bg-[#0D9488]/15 dark:text-[#5EEAD4]',
    },
    {
      icon: Users,
      title: cfg.feature2_title || 'متابعة شخصية معاك',
      description: cfg.feature2_desc || 'مستر عمرو متابع معاك شخصيًا — واجباتك، نتائجك، ومستواك. ويتواصل معاك لو محتاج مساعدة.',
      color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    },
    {
      icon: MonitorSmartphone,
      title: cfg.feature3_title || 'دروس مسجلة 24/7',
      description: cfg.feature3_desc || 'شروحات مسجلة بجودة عالية متاحة في أي وقت. شرح يربط الأحداث ببعض مع خرائط وملخصات لكل وحدة.',
      color: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    },
    {
      icon: MessageCircle,
      title: cfg.feature4_title || 'تواصل مباشر على واتساب',
      description: cfg.feature4_desc || 'تواصل مع مستر عمرو في أي وقت. اسأل سؤال، استفسر عن حصة، أو اعرف آخر الأخبار.',
      color: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    },
    {
      icon: BookOpen,
      title: cfg.feature5_title || 'واجبات وامتحانات',
      description: cfg.feature5_desc || 'واجبات أسبوعية وامتحانات دورية بأسئلة تفكير وتحليل مش مجرد حفظ. النتائج بتطلع فورًا.',
      color: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
    },
    {
      icon: HeadphonesIcon,
      title: cfg.feature6_title || 'ملخصات وخرائط زمنية',
      description: cfg.feature6_desc || 'ملخصات شاملة وخرائط زمنية لكل عصر. أدوات تساعدك تراجع بذكاء وتفهم الصورة الكاملة.',
      color: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    },
  ]

  // (و78) مميزات مضافة ديناميكيًا من الأدمن (custom_features) — بتتضاف بعد المميزات الأساسية
  try {
    const parsedCustomFeatures = JSON.parse(cfg.custom_features || '[]')
    if (Array.isArray(parsedCustomFeatures)) {
      for (let i = 0; i < parsedCustomFeatures.length; i++) {
        const cf = parsedCustomFeatures[i]
        if (!cf || typeof cf !== 'object') continue
        const cfTitleAr = typeof cf.titleAr === 'string' ? cf.titleAr : ''
        const cfDescAr = typeof cf.descAr === 'string' ? cf.descAr : ''
        if (!cfTitleAr && !cfDescAr) continue
        features.push({
          icon: FEATURE_ICONS[features.length % FEATURE_ICONS.length],
          title: cfTitleAr,
          description: cfDescAr || (typeof cf.descEn === 'string' ? cf.descEn : ''),
          color: FEATURE_COLORS[features.length % FEATURE_COLORS.length],
        })
      }
    }
  } catch (e) {}

  return (
    <section className="py-16 sm:py-20 bg-[#F0F7F4] dark:bg-[#0C1220]" dir="rtl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">{cfg.features_title || 'ليه تختار منصة القائد؟'}</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            {cfg.features_subtitle || 'منصة متكاملة فيها حصص مباشرة، دروس مسجلة، ومتابعة شخصية — كل اللي محتاجيه عشان تتفوق في التاريخ'}
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, fIdx) => (
            <Card
              key={'feature-' + fIdx + '-' + feature.title}
              className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card"
            >
              <CardContent className="p-6 space-y-4">
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-base leading-snug text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
