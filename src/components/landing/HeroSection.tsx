'use client'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { useEffect, useState } from 'react'
import { Award, GraduationCap, Users, BookOpen, Clock } from 'lucide-react'

export default function HeroSection() {
  const {
    setView,
    siteConfig,
    setSiteConfig,
    configLoaded,
    stats,
  } = useAppStore()

  const [fallbackBgExists, setFallbackBgExists] = useState(false)
  const [fallbackPhotoExists, setFallbackPhotoExists] = useState(false)

  var initialCfg = (typeof window !== 'undefined' && (window as any).__INITIAL_CONFIG__) || {}
  var cfg = configLoaded ? siteConfig : (Object.keys(siteConfig).length > 0 ? siteConfig : initialCfg)

  useEffect(() => {
    if (!configLoaded && Object.keys(siteConfig).length === 0) {
      fetch('/api/config')
        .then((r) => r.json())
        .then((data) => {
          setSiteConfig(data)
          useAppStore.getState().setConfigLoaded(true)
        })
        .catch(() => {})
    }
  }, [configLoaded, setSiteConfig, siteConfig])

  useEffect(() => {
    var hasDbBg = !!(siteConfig.hero_bg_image || '')
    var hasDbPhoto = !!(siteConfig.instructor_photo || '')
    if (!hasDbBg) {
      var img = new Image()
      img.onload = function () { setFallbackBgExists(true) }
      img.onerror = function () { setFallbackBgExists(false) }
      img.src = '/images/hero-bg.jpg'
    } else {
      setFallbackBgExists(false)
    }
    if (!hasDbPhoto) {
      var img2 = new Image()
      img2.onload = function () { setFallbackPhotoExists(true) }
      img2.onerror = function () { setFallbackPhotoExists(false) }
      img2.src = '/images/instructor.jpg'
    } else {
      setFallbackPhotoExists(false)
    }
  }, [siteConfig.hero_bg_image, siteConfig.instructor_photo])

  const dbPhoto = cfg.instructor_photo || ''
  const dbBg = cfg.hero_bg_image || ''
  const heroPhoto = dbPhoto || '/images/instructor.jpg'
  const heroBg = dbBg || '/images/hero-bg.jpg'

  const showBg = !!dbBg || fallbackBgExists
  const showPhoto = !!dbPhoto || fallbackPhotoExists

  return (
    <section className="relative overflow-hidden bg-[#F5F3EF] dark:bg-[#0F0D0A]" dir="rtl">
      {/* Banner Image at Top */}
      {showBg && (
        <div className="relative w-full">
          <img
            src={heroBg}
            alt="منصة القائد Banner"
            className="w-full h-auto max-h-[360px] object-cover object-center"
          />
          {/* Gradient overlay: hidden in light mode, dark fade in dark mode */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F0D0A] via-[#0F0D0A]/50 to-transparent opacity-0 dark:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Ambient light effects */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 right-20 h-96 w-96 rounded-full bg-[#C49A38]/8 blur-[100px]" />
        <div className="absolute bottom-20 left-20 h-72 w-72 rounded-full bg-[#C49A38]/5 blur-[80px]" />
        <div className="absolute top-16 left-10 text-[#C49A38]/10 text-6xl font-light select-none hidden lg:block">
          a2+b2=c2
        </div>
        <div className="absolute bottom-32 right-16 text-[#C49A38]/8 text-5xl font-light select-none hidden lg:block">
          f(x)
        </div>
        <div className="absolute top-1/2 left-1/3 text-[#C49A38]/6 text-4xl font-light select-none hidden xl:block">
          sum int pi
        </div>
      </div>

      {/* Subtle gradient when no banner */}
      {!showBg && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F3EF] via-[#EDE9E3] to-[#F5F3EF] dark:from-[#0F0D0A] dark:via-[#1A1714] dark:to-[#0F0D0A] -z-10" />
      )}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          {/* Text Content */}
          <div className="space-y-6 text-center lg:text-right order-2 lg:order-1">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-[#C49A38]/15 px-4 py-1.5 text-sm font-medium text-[#C49A38] border border-[#C49A38]/20">
              <Award className="h-4 w-4" />
              <span>
                {cfg.hero_badge ||
                  'Comprehensive Learning Platform | منصة تعليمية متكاملة'}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
              <span className="block text-[#C49A38]">
                {cfg.hero_title_line1 || 'منصة القائد'}
              </span>
              <span className="block mt-1 text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground/80">
                {cfg.hero_title_line2 || 'مستر عمرو رشدي'}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-xl text-muted-foreground text-base sm:text-lg leading-relaxed lg:mx-0 mx-auto">
              {cfg.hero_subtitle ||
                'نبسّط لك الدراسات والتاريخ ونجعلها سهلة وممتعة! Algebra, Geometry, Formulas, Cheat Sheets — واجبات أسبوعية، امتحانات منتظمة، ومتابعة مستمرة لتقدّمك الأكاديمي.'}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button
                size="lg"
                className="text-base px-8 py-6 min-h-[44px] bg-[#C49A38] hover:bg-[#D4A843] text-white font-semibold transition-colors duration-200"
                onClick={() => setView('auth-register')}
              >
                سجّل الآن | Register Now
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-base px-8 py-6 min-h-[44px] border-[#C49A38]/40 text-[#C49A38] hover:bg-[#C49A38]/10 hover:text-[#C49A38] transition-colors duration-200"
                onClick={() => setView('auth-login')}
              >
                لديّ حساب | I Have an Account
              </Button>
            </div>

            {/* Hero Developer / Adam Hawash branding */}
            <div className="pt-4 flex flex-col items-center lg:items-start gap-1">
              <a
                href={cfg.hero_developer_url || 'https://hero-developer-portfolio-11.vercel.app'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-muted-foreground/50 hover:text-[#C49A38] transition-colors underline underline-offset-4 decoration-muted-foreground/20 hover:decoration-[#C49A38]/50"
              >
                Hero Developer
              </a>
              <div className="h-px w-16 bg-border" />
              <a
                href={cfg.hero_developer_url || 'https://hero-developer-portfolio-11.vercel.app'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground/30 font-light tracking-wider hover:text-[#C49A38] transition-colors"
              >
                Made by Adam Hawash
              </a>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center lg:justify-start gap-8 pt-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <BookOpen className="h-4 w-4 text-[#C49A38]/60" />
                  <p className="text-2xl font-bold text-[#C49A38]">
                    {stats?.totalVideos
                      ? stats.totalVideos
                      : cfg.hero_stat1_value || '100+'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {cfg.hero_stat1_label || 'Video Lessons | دروس فيديو'}
                </p>
              </div>

              <div className="h-8 w-px bg-border" />

              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Users className="h-4 w-4 text-[#C49A38]/60" />
                  <p className="text-2xl font-bold text-[#C49A38]">
                    {stats?.approvedStudents
                      ? stats.approvedStudents
                      : cfg.hero_stat2_value || '500+'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {cfg.hero_stat2_label || 'Students | طالب'}
                </p>
              </div>

              <div className="h-8 w-px bg-border" />

              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Clock className="h-4 w-4 text-[#C49A38]/60" />
                  <p className="text-2xl font-bold text-[#C49A38]">
                    {cfg.hero_stat3_value || '24/7'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {cfg.hero_stat3_label || 'Tracking | متابعة'}
                </p>
              </div>
            </div>
          </div>

          {/* Instructor Photo */}
          <div className="flex justify-center lg:justify-end order-1 lg:order-2">
            <div className="relative group">
              {/* Gold glow ring */}
              <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-[#C49A38]/20 via-[#C49A38]/5 to-transparent blur-2xl transition-opacity duration-500 group-hover:opacity-80" />
              <div className="relative w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 rounded-full overflow-hidden border-2 border-[#C49A38]/30 gold-glow bg-[#EDE9E3] dark:bg-[#1A1714]">
                {showPhoto ? (
                  <img
                    src={heroPhoto}
                    alt={cfg.instructor_name || 'مستر عمرو رشدي'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#C49A38]/30">
                    <GraduationCap className="h-24 w-24" />
                  </div>
                )}
              </div>
              {/* Badge overlay */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1A1714] border border-[#C49A38]/30 rounded-full px-4 py-1.5 shadow-sm">
                <p className="text-[#C49A38] font-bold text-sm tracking-wider">
                  {(cfg.hero_title_line1 || 'منصة القائد').toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
