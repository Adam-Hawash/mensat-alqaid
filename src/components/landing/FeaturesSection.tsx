'use client'

import { useAppStore } from '@/stores/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Video, Users, BookOpen, MonitorSmartphone, HeadphonesIcon, MessageCircle } from 'lucide-react'

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
          {features.map((feature) => (
            <Card
              key={feature.title}
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
