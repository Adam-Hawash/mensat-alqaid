'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useAppStore, GRADES } from '@/stores/app-store'
import { toast } from 'sonner'

var gradeIcons: Record<string, string> = {
  'الصف السادس الابتدائي': '6',
  'الصف الأول الاعدادي': '1',
  'الصف الثاني الاعدادي': '2',
  'الصف الثالث الاعدادي': '3',
  'أولى بكالوريا': '  1B',
}

var grades = GRADES.map(function(g) { return { id: g, name: g, icon: gradeIcons[g] || g[0] } })

export function GradesSection() {
  var { siteConfig } = useAppStore()
  var cfg = siteConfig

  var handleGradeClick = function(gradeName: string) {
    toast.info('سجّل أولاً ثم ادخل حسابك للوصول إلى مواد ' + gradeName)
    useAppStore.getState().setShowStudentRegister(true)
  }

  return (
    <section className="py-12 sm:py-20 bg-[#F0F7F4] dark:bg-[#0C1220]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">{cfg.grades_title || 'السنوات الدراسية'}</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            {cfg.grades_subtitle || 'اختر صفك الدراسي للوصول إلى المحتوى التعليمي المخصص لك'}
          </p>
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {grades.map(function(grade) {
            return (
              <Card
                key={grade.id}
                className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 border-border/50 bg-card"
                onClick={function() { handleGradeClick(grade.name) }}
              >
                <CardContent className="p-4 sm:p-6 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <span className="text-xl font-bold text-primary">
                      {grade.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm leading-tight text-foreground">
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
