'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useAppStore, GRADES } from '@/stores/app-store'
import { toast } from 'sonner'

var gradeIcons: Record<string, string> = {
  'أولى إعدادي': '1ع',
  'تانية إعدادي': '2ع',
  'تالتة إعدادي': '3ع',
  'أولى بكالوريا': '1ب',
  'تانية بكالوريا': '2ب',
}

var gradeColors: Record<string, string> = {
  'أولى إعدادي': 'bg-[#0D9488]/10 text-[#0D9488] group-hover:bg-[#0D9488] group-hover:text-white',
  'تانية إعدادي': 'bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white',
  'تالتة إعدادي': 'bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white',
  'أولى بكالوريا': 'bg-rose-500/10 text-rose-600 group-hover:bg-rose-500 group-hover:text-white',
  'تانية بكالوريا': 'bg-sky-500/10 text-sky-600 group-hover:bg-sky-500 group-hover:text-white',
}

var grades = GRADES.map(function(g) { return { id: g, name: g, icon: gradeIcons[g] || g[0], color: gradeColors[g] || 'bg-primary/10 text-primary' } })

export function GradesSection() {
  var { siteConfig } = useAppStore()
  var cfg = siteConfig

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
          {grades.map(function(grade) {
            return (
              <Card
                key={grade.id}
                className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 border-border/50 bg-card overflow-hidden"
                onClick={function() { handleGradeClick(grade.name) }}
              >
                <CardContent className="p-5 sm:p-6 text-center space-y-4">
                  <div className={"mx-auto flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 " + grade.color}>
                    <span className="text-2xl font-bold">
                      {grade.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base leading-tight text-foreground">
                      {grade.name}
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
