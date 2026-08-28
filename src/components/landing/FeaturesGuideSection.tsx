'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/stores/app-store'
import {
  UserPlus,
  Video,
  ClipboardList,
  FileCheck,
  MessageSquare,
  BarChart3,
  Compass,
} from 'lucide-react'

var GUIDE_ICONS = [UserPlus, Video, ClipboardList, FileCheck, MessageSquare, BarChart3]
var GUIDE_COLORS = [
  'bg-[#0D9488]/10 text-[#0D9488] dark:bg-[#0D9488]/15 dark:text-[#5EEAD4]',
  'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  'bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  'bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
]

export default function FeaturesGuideSection() {
  var { siteConfig } = useAppStore()
  var cfg = siteConfig

  var cards = [
    {
      icon: GUIDE_ICONS[0],
      titleAr: cfg.guide_card1_title || 'سجّل حسابك',
      titleEn: cfg.guide_card1_title_en || 'Create Your Account',
      description: cfg.guide_card1_desc || 'أنشئ حسابك في منصة القائد باسمك وصفك الدراسي. العملية تستغرق أقل من دقيقة وتبدأ فورًا في الوصول لمحتوى التاريخ والدراسات. Sign up in under a minute and access all history content.',
      color: GUIDE_COLORS[0],
    },
    {
      icon: GUIDE_ICONS[1],
      titleAr: cfg.guide_card2_title || 'تابع الدروس المسجّلة',
      titleEn: cfg.guide_card2_title_en || 'Watch Recorded Lessons',
      description: cfg.guide_card2_desc || 'شروحات مبسّطة ومتسلسلة لكل وحدة تاريخية: من الحضارات القديمة لحد العصر الحديث. كل درس مرتبط باللي قبله عشان تبني الصورة الكاملة. Simplified lessons from ancient civilizations to the modern era, each building on the previous one.',
      color: GUIDE_COLORS[1],
    },
    {
      icon: GUIDE_ICONS[2],
      titleAr: cfg.guide_card3_title || 'حل الواجبات الأسبوعية',
      titleEn: cfg.guide_card3_title_en || 'Complete Weekly Homework',
      description: cfg.guide_card3_desc || 'واجبات أسبوعية تركز على ربط الأحداث وتحليل الخرائط الزمنية. مش مجرد حفظ — ده فهم وتحليل وتطبيق على أحداث حقيقية. Weekly assignments focused on connecting events and analyzing timelines, not just memorization.',
      color: GUIDE_COLORS[2],
    },
    {
      icon: GUIDE_ICONS[3],
      titleAr: cfg.guide_card4_title || 'جرّب الامتحانات التجريبية',
      titleEn: cfg.guide_card4_title_en || 'Take Practice Exams',
      description: cfg.guide_card4_desc || 'امتحانات شبه الامتحان الحقيقي بأسئلة تفكير وتحليل. تابع نتيجتك فورًا واعرف نقاط قوّتك واللي محتاج تراجعه قبل الامتحان. Realistic practice exams with analytical questions and instant results.',
      color: GUIDE_COLORS[3],
    },
    {
      icon: GUIDE_ICONS[4],
      titleAr: cfg.guide_card5_title || 'انضم للحصص المباشرة',
      titleEn: cfg.guide_card5_title_en || 'Join Live Sessions',
      description: cfg.guide_card5_desc || 'حصص مباشرة على Zoom مع مستر عمرو رشدي. اسأل واستفهم لحظة بلحظة، وشارك في مناقشات جماعية مع زملائك. Live Zoom sessions with Mr. Amr — ask questions in real-time and join group discussions.',
      color: GUIDE_COLORS[4],
    },
    {
      icon: GUIDE_ICONS[5],
      titleAr: cfg.guide_card6_title || 'تابع تقدّمك',
      titleEn: cfg.guide_card6_title_en || 'Track Your Progress',
      description: cfg.guide_card6_desc || 'لوحة متابعة توريّك مستواك في كل وحدة: كم درس شاهدته، واجب حلّه، وامتحان خلصته. اعرف بالضبط إزاي تتقدّم وإيه اللي محتاج مجهود أكتر. A progress dashboard showing lessons watched, homework done, and exam scores.',
      color: GUIDE_COLORS[5],
    },
  ]

  return (
    <section className="py-16 sm:py-20 bg-[#F0F7F4] dark:bg-[#0C1220]" dir="rtl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Compass className="h-4 w-4" />
            <span>{cfg.guide_badge || 'إزاي تستخدم المنصة؟ | Getting Started'}</span>
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">
            {cfg.guide_title || 'خطوات بسيطة تبدأ بيها رحلتك | Start Your Journey in Simple Steps'}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            {cfg.guide_subtitle || 'ست خطوات هتوصلك من التسجيل لحد التفوّق في التاريخ والدراسات — Six steps from sign-up to excellence in history'}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(function(card, index) {
            return (
              <Card
                key={card.titleEn}
                className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={"inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 " + card.color}
                    >
                      <card.icon className="h-6 w-6" />
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium bg-[#0D9488]/10 text-[#0D9488]"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-base leading-snug text-foreground">
                    <span className="block">{card.titleAr}</span>
                    <span className="block text-sm text-muted-foreground font-normal mt-0.5">
                      {card.titleEn}
                    </span>
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
