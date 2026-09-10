'use client'

// لوحة الشرف على الصفحة الرئيسية (2026-و18/18-d) — «🏆 أفضل 3 طلاب»
// طلب المستر: قسم عام على لاندينج المنصة يعرض ترتيب أول 3 طلاب حسب
// النقاط (امتحانات + واجبات) من غير ما حد يسجل دخول.
// بتسحب من /api/leaderboard (عام — اسم كلمتين + صف + نقاط بس،
// مفيش تليفونات) — شكل منصة تتويج: تاني يمين، أول في النص، تالث شمال.

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, Crown, Zap, Users } from 'lucide-react'
import { useState, useEffect } from 'react'

type BoardEntry = {
  rank: number
  name: string
  grade: string
  points: number
  pointsLabel: string
}

// ستايل التتويج — دهب/فضة/برونز (ألوان محايدة شغالة فاتح وغامق)
var MEDALS = [
  {
    emoji: '🥇',
    ring: 'ring-2 ring-amber-400/60',
    chip: 'bg-amber-400/15 text-amber-700 dark:text-amber-400 border border-amber-400/40',
    base: 'bg-gradient-to-t from-amber-400/60 to-amber-400/25 text-amber-900 dark:text-amber-100',
    lift: 'sm:-mt-3',
    baseH: 'h-14 sm:h-16',
  },
  {
    emoji: '🥈',
    ring: 'ring-1 ring-slate-400/50',
    chip: 'bg-slate-400/15 text-slate-700 dark:text-slate-300 border border-slate-400/40',
    base: 'bg-gradient-to-t from-slate-400/50 to-slate-400/20 text-slate-800 dark:text-slate-100',
    lift: 'sm:mt-4',
    baseH: 'h-9 sm:h-11',
  },
  {
    emoji: '🥉',
    ring: 'ring-1 ring-orange-700/40',
    chip: 'bg-orange-700/10 text-orange-800 dark:text-orange-400 border border-orange-700/40',
    base: 'bg-gradient-to-t from-orange-700/45 to-orange-700/15 text-orange-100 dark:text-orange-100',
    lift: 'sm:mt-8',
    baseH: 'h-7 sm:h-8',
  },
]

function PodiumSlot({ entry }: { entry: BoardEntry | undefined }) {
  if (!entry) {
    // خانة فاضية (لما مايكونش فيه 3 طلاب بنقاط) — بنحافظ على شكل المنصة
    return (
      <div className="flex flex-col justify-end" aria-hidden="true">
        <div className="h-24 sm:h-32" />
        <div className="h-7 sm:h-11 rounded-t-xl bg-muted/50 border border-border/40" />
      </div>
    )
  }
  var medal = MEDALS[entry.rank - 1] || MEDALS[2]
  var isFirst = entry.rank === 1
  return (
    <div className={'flex flex-col justify-end gap-2 sm:gap-3 ' + medal.lift}>
      <Card className={'relative w-full border-border/50 bg-card shadow-sm hover:shadow-md transition-shadow ' + medal.ring}>
        <CardContent className={'p-3 sm:p-4 flex flex-col items-center text-center gap-1.5 sm:gap-2 ' + (isFirst ? 'pt-4 sm:pt-5' : '')}>
          {isFirst && <Crown className="h-5 w-5 text-amber-500 absolute -top-3" aria-hidden="true" />}
          <span className={'text-2xl sm:text-3xl leading-none ' + (isFirst ? 'sm:text-4xl' : '')} role="img" aria-label={'المركز ' + entry.rank}>
            {medal.emoji}
          </span>
          <p className={'font-bold text-foreground leading-snug max-w-full truncate ' + (isFirst ? 'text-sm sm:text-base' : 'text-xs sm:text-sm')}>
            {entry.name}
          </p>
          {entry.grade && (
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-snug max-w-full truncate">{entry.grade}</p>
          )}
          <span className={'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold whitespace-nowrap ' + medal.chip}>
            <Zap className="h-3 w-3" aria-hidden="true" />
            <span dir="rtl">{entry.pointsLabel}</span>
          </span>
        </CardContent>
      </Card>
      {/* قاعدة المنصة — الرقم عليها والارتفاع بيقول المكان */}
      <div className={'w-full rounded-t-xl border border-b-0 border-border/40 flex items-start justify-center pt-1 text-sm sm:text-base font-extrabold ' + medal.base + ' ' + medal.baseH}>
        {entry.rank}
      </div>
    </div>
  )
}

export default function LeaderboardSection() {
  // null = لسه بنحمّل (سكيليتون) | [] = مفيش أبطال لسه (حالة فاضية)
  var [board, setBoard] = useState<BoardEntry[] | null>(null)

  useEffect(function () {
    var alive = true
    fetch('/api/leaderboard', { cache: 'no-store' })
      .then(function (r) {
        return r.json()
      })
      .then(function (data) {
        if (!alive) return
        setBoard(Array.isArray(data && data.leaderboard) ? data.leaderboard : [])
      })
      .catch(function () {
        if (alive) setBoard([])
      })
    return function () {
      alive = false
    }
  }, [])

  // ترتيب المنصة بالعربي (RTL): تاني يمين ← أول في النص ← تالث شمال
  var podium: (BoardEntry | undefined)[] = board && board.length > 0 ? [board[1], board[0], board[2]] : []

  return (
    <section className="py-16 sm:py-20 relative bg-[#F0F7F4] dark:bg-[#0C1220]" dir="rtl">
      {/* هالة ضوء خفيفة ورا المنصة */}
      <div className="absolute inset-x-0 top-10 -z-0 mx-auto h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 relative z-10">
        {/* رأس القسم — نفس ستايل أقسام اللاندينج */}
        <div className="text-center mb-10 sm:mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Trophy className="h-4 w-4" />
            <span>لوحة الشرف</span>
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">🏆 أفضل 3 طلاب</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            ترتيب الطلاب حسب مجموع النقاط من الامتحانات والواجبات — حلّ واجمع نقاطك علشان مكانك يكون هنا!
          </p>
        </div>

        {/* لسه بنحمّل → سكيليتون بنفس شكل المنصة */}
        {board === null && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mx-auto" aria-hidden="true">
            <div className="flex flex-col gap-2 sm:mt-4">
              <Skeleton className="h-24 sm:h-32 w-full rounded-xl" />
              <Skeleton className="h-9 sm:h-11 w-full rounded-t-xl" />
            </div>
            <div className="flex flex-col gap-2 sm:-mt-3">
              <Skeleton className="h-28 sm:h-36 w-full rounded-xl" />
              <Skeleton className="h-14 sm:h-16 w-full rounded-t-xl" />
            </div>
            <div className="flex flex-col gap-2 sm:mt-8">
              <Skeleton className="h-24 sm:h-32 w-full rounded-xl" />
              <Skeleton className="h-7 sm:h-8 w-full rounded-t-xl" />
            </div>
          </div>
        )}

        {/* مفيش نتايج لسه → حالة فاضية لطيفة */}
        {board !== null && board.length === 0 && (
          <Card className="max-w-md mx-auto border-dashed border-border/60 bg-card/70">
            <CardContent className="p-6 sm:p-8 text-center space-y-3">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Trophy className="h-7 w-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground">لسه مفيش أبطال على المنصة</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                أول ما الطلاب يبدأوا يحلوا الامتحانات والواجبات ويجمعوا نقاط — أول 3 سنعرضهم هنا تلقائيًا.
              </p>
            </CardContent>
          </Card>
        )}

        {/* منصة التتويج — 1 في النص (أطول قاعدة) و2 يمين و3 شمال */}
        {board !== null && board.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mx-auto">
            <PodiumSlot entry={podium[0]} />
            <PodiumSlot entry={podium[1]} />
            <PodiumSlot entry={podium[2]} />
          </div>
        )}

        {/* سطر توضيحي صغير تحت المنصة */}
        {board !== null && board.length > 0 && (
          <p className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-1.5 w-full justify-center">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            النقاط بتتحدث تلقائيًا بعد كل امتحان أو واجب يتسلم
          </p>
        )}
      </div>
    </section>
  )
}
