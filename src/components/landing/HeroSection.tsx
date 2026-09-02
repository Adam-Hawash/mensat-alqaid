'use client'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { useEffect, useState } from 'react'
import { UserPlus, LogIn } from 'lucide-react'

export default function HeroSection() {
  const {
    setView,
    siteConfig,
    setSiteConfig,
    configLoaded,
    stats,
  } = useAppStore()

  const [photoLoaded, setPhotoLoaded] = useState(false)

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

  var dbPhoto = cfg.instructor_photo || ''
  var heroPhoto = dbPhoto || '/images/instructor.jpg'
  var hasPhoto = !!dbPhoto

  useEffect(() => {
    if (hasPhoto) {
      var img = new Image()
      img.onload = function () { setPhotoLoaded(true) }
      img.src = dbPhoto
    }
  }, [dbPhoto, hasPhoto])

  var instructorName = cfg.instructor_name || 'مستر عمرو رشدي'
  var heroTitle = cfg.hero_title_line1 || 'منصة القائد'
  var heroSubtitle = cfg.hero_subtitle || 'هنساعدك تفهم التاريخ والدراسات بأسلوب سهل وبسيط'
  var heroBadge = cfg.hero_badge || 'تاريخ ودراسات ببساطة'
  var heroDevLabel = cfg.hero_developer_label || 'Hero Developer'
  var heroDevUrl = cfg.hero_developer_url || 'https://hero-developer-portfolio-11.vercel.app'

  return (
    <section className="relative overflow-hidden" dir="rtl" style={{ background: 'linear-gradient(135deg, #0a2e2f 0%, #0F3D3E 40%, #1a4d4d 100%)' }}>
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Yellow dots scattered */}
        <div className="absolute top-[15%] right-[10%] w-2 h-2 rounded-full bg-yellow-400/60" />
        <div className="absolute top-[25%] right-[25%] w-1.5 h-1.5 rounded-full bg-yellow-400/40" />
        <div className="absolute top-[60%] right-[8%] w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
        <div className="absolute top-[70%] right-[30%] w-1 h-1 rounded-full bg-yellow-400/30" />
        <div className="absolute top-[40%] left-[15%] w-2 h-2 rounded-full bg-yellow-400/40" />
        <div className="absolute bottom-[20%] left-[25%] w-1.5 h-1.5 rounded-full bg-yellow-400/50" />
        {/* Geometric shapes */}
        <div className="absolute top-[20%] left-[8%] w-12 h-12 border-2 border-blue-400/20 rounded-full" />
        <div className="absolute top-[45%] left-[5%] w-8 h-8 border border-orange-400/15 rotate-45" />
        <div className="absolute bottom-[15%] right-[15%] w-16 h-16 border border-yellow-400/10 rounded-full" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          {/* Text Content - Right Side in RTL */}
          <div className="space-y-6 text-center lg:text-right order-2 lg:order-1">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-yellow-300/90 border border-yellow-400/20">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span>{heroBadge}</span>
            </div>

            {/* Prefix */}
            <p className="text-white/70 text-lg sm:text-xl font-light">
              {heroTitle}
            </p>

            {/* Name - Large Golden */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl" style={{ color: '#FFB800' }}>
              {instructorName}
            </h1>

            {/* Subtitle */}
            <p className="max-w-xl text-white/75 text-base sm:text-lg leading-relaxed lg:mx-0 mx-auto">
              {heroSubtitle}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
              <Button
                size="lg"
                className="text-base px-8 py-6 min-h-[44px] bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-black/20"
                onClick={() => setView('auth-register')}
              >
                <UserPlus className="h-5 w-5 ml-2" />
                إنشاء حسابك +
              </Button>
              <Button
                size="lg"
                className="text-base px-8 py-6 min-h-[44px] bg-[#F97316] hover:bg-[#FB923C] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/30 border border-orange-400/30"
                onClick={() => setView('auth-login')}
              >
                <LogIn className="h-5 w-5 ml-2" />
                سجل دخولك
              </Button>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center lg:justify-start gap-6 sm:gap-10 pt-8">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {stats?.totalVideos ? stats.totalVideos : '100+'}
                </p>
                <p className="text-xs text-white/50 mt-1">درس فيديو</p>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {stats?.approvedStudents ? stats.approvedStudents : '500+'}
                </p>
                <p className="text-xs text-white/50 mt-1">طالب نشط</p>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">24/7</p>
                <p className="text-xs text-white/50 mt-1">متابعة مستمرة</p>
              </div>
            </div>

            {/* Hero Developer link - under stats, aligned to right (start in RTL) */}
            <div className="flex justify-center lg:justify-start pt-4">
              <a
                href={heroDevUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-white/45 hover:text-yellow-300 transition-colors group"
              >
                <span className="text-yellow-400/70">&lt;/&gt;</span>
                <span className="font-semibold group-hover:underline underline-offset-2">{heroDevLabel}</span>
              </a>
            </div>
          </div>

          {/* Instructor Photo - Left Side in RTL */}
          <div className="flex justify-center lg:justify-end order-1 lg:order-2">
            <div className="relative pb-10">
              {/* Orange geometric backdrop shape */}
              <div className="absolute -bottom-2 -left-4 sm:-bottom-4 sm:-left-8 w-44 h-36 sm:w-64 sm:h-52 lg:w-72 lg:h-56" style={{
                background: 'linear-gradient(135deg, #F97316 0%, #FB923C 55%, #FDBA74 100%)',
                clipPath: 'polygon(28% 0%, 100% 0%, 72% 100%, 0% 100%)'
              }} />
              {/* Soft orange glow */}
              <div className="absolute -top-6 -right-6 w-32 h-32 sm:w-44 sm:h-44 rounded-full pointer-events-none" style={{
                background: 'radial-gradient(circle, rgba(251,146,60,0.35) 0%, rgba(251,146,60,0) 70%)'
              }} />
              {/* Dotted circle decorations */}
              <svg className="absolute -top-8 -left-10 w-24 h-24 sm:w-32 sm:h-32 opacity-40 pointer-events-none" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#5EEAD4" strokeWidth="2.5" strokeDasharray="3 7" />
              </svg>
              <svg className="absolute -bottom-14 -right-8 w-20 h-20 sm:w-28 sm:h-28 opacity-30 pointer-events-none" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#5EEAD4" strokeWidth="2.5" strokeDasharray="3 7" />
              </svg>

              {/* Photo container with orange offset frame */}
              <div className="relative">
                <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[28px]" style={{ background: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)' }} />
                <div className="relative w-72 h-80 sm:w-80 sm:h-[420px] lg:w-[400px] lg:h-[460px] rounded-[28px] overflow-hidden bg-[#1a4d4d] shadow-2xl">
                  {hasPhoto && photoLoaded ? (
                    <img
                      src={heroPhoto}
                      alt={instructorName}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: '50% 25%' }}
                    />
                  ) : hasPhoto ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-2 border-white/30 border-t-white rounded-full" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Orange chevrons below photo */}
              <div className="absolute -bottom-6 left-2 sm:left-6 hidden sm:flex items-end gap-1 pointer-events-none" dir="ltr" aria-hidden="true">
                <span className="text-5xl lg:text-6xl font-black leading-none text-orange-400 drop-shadow-lg">«</span>
                <span className="text-4xl lg:text-5xl font-black leading-none text-orange-400/80 drop-shadow-lg">«</span>
                <span className="text-3xl lg:text-4xl font-black leading-none text-orange-400/60 drop-shadow-lg">«</span>
              </div>

              {/* Name badge below photo */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2 shadow-lg">
                <p className="text-white font-bold text-sm tracking-wider whitespace-nowrap">
                  {instructorName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
