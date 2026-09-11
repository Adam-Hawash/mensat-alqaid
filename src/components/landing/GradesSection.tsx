'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useAppStore, gradesFromConfig } from '@/stores/app-store'
import { toast } from 'sonner'

// (24-e) القايمة بقت ديناميكية من لوحة الأدمن — والإيموجي هو اللي بيظهر في الكارت
// الألوان بقت بالات بسيطة بتتوزع على الصفوف بالترتيب (نفس ألوان التصميم القديم)
var GRADE_CARD_COLORS = [
  'bg-[#0D9488]/10 text-[#0D9488] group-hover:bg-[#0D9488] group-hover:text-white',
  'bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white',
  'bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white',
  'bg-rose-500/10 text-rose-600 group-hover:bg-rose-500 group-hover:text-white',
  'bg-sky-500/10 text-sky-600 group-hover:bg-sky-500 group-hover:text-white',
]

export function GradesSection() {
  var { siteConfig } = useAppStore()
  var cfg = siteConfig
  // (24-e) القايمة بقت ديناميكية من قايمة الصفوف في لوحة الأدمن
  var grades = gradesFromConfig(siteConfig)

  var handleGradeClick = function(gradeName: string) {
    toast.info('سجّل حسابك الأول عشان توصل لمحتوى ' + gradeName)
    useAppStore.getState().setShowStudentRegister(true)
  }

  return (
    <section className="py-16 sm:py-20 bg-background dark:bg-[#0C1220]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <span>&#127891;</span>
            <span>{cfg.grades_badge || 'اختار سنتك | Choose Your Grade'}</span>
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">
            {cfg.grades_title || 'السنات الدراسية المتاحة'}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            {cfg.grades_subtitle || 'اختار السنة بتاعتك وهنجيبلك المحتوى المناسب ليكي — كل سنة ليها دروس وواجبات وامتحانات خاصة بيها'}
          </p>
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {grades.map(function(grade, gradeIdx) {
            var color = GRADE_CARD_COLORS[gradeIdx % GRADE_CARD_COLORS.length]
            return (
              <Card
                key={grade.ar}
                className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 border-border/50 bg-card overflow-hidden"
                onClick={function() { handleGradeClick(grade.ar) }}
              >
                <CardContent className="p-5 sm:p-6 text-center space-y-4">
                  <div className={"mx-auto flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 " + color}>
                    <span className="text-2xl leading-none" role="img" aria-label={grade.ar}>
                      {grade.emoji || grade.short || grade.ar[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base leading-tight text-foreground">
                      {grade.ar}
                    </h3>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
