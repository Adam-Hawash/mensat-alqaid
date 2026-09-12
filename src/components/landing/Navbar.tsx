'use client'

import { useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import {
  Sun,
  Moon,
  LogOut,
  UserPlus,
  LogIn,
  Menu,
  X,
  LayoutDashboard,
  Youtube,
  Heart,
  CalendarClock,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
/* (2026-و29) «أوائل الطلبة» في النافبار — طلب المستر: زرار يفتح دايلوج بأول
   3 طلاب — والقسم اتشال من الصفحة الرئيسية */
import { TopStudentsDialog } from './TopStudentsDialog'

const FALLBACK_PORTFOLIO_URL = 'https://hero-developer-portfolio-11.vercel.app'

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const emptySubscribe = () => () => {}
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const [mobileMenu, setMobileMenu] = useState(false)
  /* (2026-و29) دايلوج أوائل الطلبة */
  const [topStudentsOpen, setTopStudentsOpen] = useState(false)

  const {
    currentView,
    setView,
    currentStudent,
    currentAdmin,
    isAdminLoggedIn,
    logout,
    siteConfig,
  } = useAppStore()

  const cfg = siteConfig
  const instructorPhoto = cfg.instructor_photo || ''
  const youtubeLink = cfg.social_youtube || ''
  const navBrand = cfg.navbar_brand || 'منصة القائد'
  const navSubtitle = cfg.navbar_subtitle || 'مستر عمرو رشدي'
  const portfolioUrl = cfg.hero_developer_url || FALLBACK_PORTFOLIO_URL
  const madeByLabel = cfg.footer_made_by_label || 'Made by Adam Hawash'

  const isAuthenticated = !!currentStudent || isAdminLoggedIn

  const handleLogout = () => {
    logout()
    setMobileMenu(false)
    toast.success('تم تسجيل الخروج')
  }

  const handleGoHome = () => {
    if (currentAdmin && isAdminLoggedIn) return
    setView('landing')
    setMobileMenu(false)
  }

  const handleLoginClick = () => {
    setView('auth-login')
    setMobileMenu(false)
  }

  const handleRegisterClick = () => {
    setView('auth-register')
    setMobileMenu(false)
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top bar - Made by Adam Hawash (centered, above navbar) */}
      {currentView === 'landing' && (
        <div className="w-full bg-[#0a2e2f] text-white/90 border-b border-white/10">
          <a
            href={portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-1.5 text-[11px] hover:text-yellow-300 transition-colors group"
          >
            <span className="font-semibold group-hover:underline underline-offset-2">{madeByLabel}</span>
            <Heart className="h-2.5 w-2.5 text-red-400" />
          </a>
        </div>
      )}

      {/* Main Navbar - sticky, solid white background so all text/buttons are clearly visible */}
      <div className="w-full bg-white dark:bg-[#0C1220] border-b border-border shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <button
          onClick={handleGoHome}
          className="flex items-center gap-2 transition-opacity hover:opacity-80 cursor-pointer"
        >
          {instructorPhoto ? (
            <Image
              src={instructorPhoto}
              alt={navSubtitle}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover border-2 border-yellow-400/50"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white">
              <span className="text-xs font-bold">قائد</span>
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-[10px] text-muted-foreground leading-tight">MR</p>
            <h1 className="text-sm font-bold leading-tight text-foreground">
              {navBrand}
            </h1>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-2">
          {/* (24-e) رابط مواعيد السنتر — صفحة مستقلة /schedule */}
          <a
            href="/schedule"
            className="inline-flex items-center min-h-[44px] px-3 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
            title="مواعيد السنتر"
          >
            <CalendarClock className="h-4 w-4 ml-1" />
            مواعيد السنتر
          </a>
          {/* (2026-و29) أوائل الطلبة — دايلوج أول 3 طلاب (والقسم اتشال من الرئيسية) */}
          <button
            type="button"
            onClick={function () { setTopStudentsOpen(true) }}
            title="أوائل الطلبة — أفضل 3 طلاب"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-md text-sm font-bold text-[#8A6D22] dark:text-[#E5BE5A] hover:bg-[#C49A38]/10 transition-colors cursor-pointer"
          >
            <Trophy className="h-4 w-4" />
            أوائل الطلبة
          </button>
          {currentStudent ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                أهلاً بـ{' '}
                <span className="font-semibold text-foreground">
                  {currentStudent.name}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 ml-1" />
                خروج
              </Button>
            </div>
          ) : isAdminLoggedIn && currentAdmin ? (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px] text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => setView('admin-dashboard')}
              >
                <LayoutDashboard className="h-4 w-4 ml-1" />
                لوحة التحكم
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 ml-1" />
                خروج
              </Button>
            </div>
          ) : (
            <>
              <Button
                size="sm"
                className="min-h-[44px] bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold"
                onClick={handleLoginClick}
              >
                <LogIn className="h-4 w-4 ml-1" />
                سجل دخولك
              </Button>
              <Button
                size="sm"
                className="min-h-[44px] bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold"
                onClick={handleRegisterClick}
              >
                <UserPlus className="h-4 w-4 ml-1" />
                إنشاء حسابك +
              </Button>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {/* (2026-و29) «أوائل الطلبة» في الموبايل — دايلوج أول 3 طلاب */}
          <button
            type="button"
            onClick={function () { setTopStudentsOpen(true) }}
            title="أوائل الطلبة — أفضل 3"
            aria-label="أوائل الطلبة — أفضل 3 طلاب"
            className="md:hidden flex items-center gap-1 min-h-[44px] px-2.5 rounded-xl text-[#8A6D22] dark:text-[#E5BE5A] bg-[#C49A38]/10 border border-[#C49A38]/40 hover:bg-[#C49A38]/20 transition-colors cursor-pointer"
          >
            <Trophy className="h-5 w-5" />
            <span className="text-xs font-bold">الأوائل</span>
          </button>
          {youtubeLink && (
            <a
              href={youtubeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-red-500 transition-colors"
              title="YouTube"
            >
              <Youtube className="h-4 w-4" />
            </a>
          )}

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] text-foreground hover:bg-accent"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden min-h-[44px] min-w-[44px] text-foreground hover:bg-accent"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label={mobileMenu ? 'اقفل القائمة' : 'افتح القائمة'}
          >
            {mobileMenu ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu - solid background so all text is clearly visible */}
      {mobileMenu && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 space-y-2">
          {/* (24-e) رابط مواعيد السنتر — صفحة مستقلة /schedule */}
          <a
            href="/schedule"
            onClick={() => setMobileMenu(false)}
            className="flex items-center w-full min-h-[44px] px-3 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <CalendarClock className="h-4 w-4 ml-2" />
            مواعيد السنتر
          </a>
          {/* (2026-و29) أوائل الطلبة في قايمة الموبايل كمان */}
          <button
            type="button"
            onClick={function () { setMobileMenu(false); setTopStudentsOpen(true) }}
            className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-[#C49A38]/40 bg-[#C49A38]/10 text-[#8A6D22] dark:text-[#E5BE5A] font-bold text-sm cursor-pointer"
          >
            <Trophy className="h-4 w-4" />
            أوائل الطلبة
          </button>
          {currentStudent ? (
            <>
              <p className="text-sm text-muted-foreground py-2">
                أهلاً بـ{' '}
                <span className="font-semibold text-foreground">
                  {currentStudent.name}
                </span>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full min-h-[44px] text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 ml-1" />
                خروج
              </Button>
            </>
          ) : isAdminLoggedIn && currentAdmin ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="w-full min-h-[44px] justify-start text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setView('admin-dashboard')
                  setMobileMenu(false)
                }}
              >
                <LayoutDashboard className="h-4 w-4 ml-2" />
                لوحة التحكم
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full min-h-[44px] text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 ml-1" />
                خروج
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                className="w-full min-h-[44px] bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold"
                onClick={handleLoginClick}
              >
                <LogIn className="h-4 w-4 ml-1" />
                سجل دخولك
              </Button>
              <Button
                size="sm"
                className="w-full min-h-[44px] bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold"
                onClick={handleRegisterClick}
              >
                <UserPlus className="h-4 w-4 ml-1" />
                إنشاء حسابك +
              </Button>
            </>
          )}
        </div>
      )}
      </div>

      {/* (2026-و29) دايلوج أوائل الطلبة — أول 3 طلاب */}
      <TopStudentsDialog open={topStudentsOpen} onOpenChange={setTopStudentsOpen} />
    </header>
  )
}
