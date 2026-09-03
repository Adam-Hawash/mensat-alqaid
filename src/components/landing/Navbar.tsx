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
} from 'lucide-react'
import { toast } from 'sonner'

const FALLBACK_PORTFOLIO_URL = 'https://hero-developer-portfolio-11.vercel.app'

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const emptySubscribe = () => () => {}
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const [mobileMenu, setMobileMenu] = useState(false)

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

      {/* Main Navbar - sticky, fully transparent so hero shows through */}
      <div className="w-full bg-transparent">
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
            <p className="text-[10px] text-white/60 leading-tight">MR</p>
            <h1 className="text-sm font-bold leading-tight text-white">
              {navBrand}
            </h1>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-2">
          {currentStudent ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70">
                أهلاً بـ{' '}
                <span className="font-semibold text-white">
                  {currentStudent.name}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] border-white/30 text-white hover:bg-white/10 hover:text-white"
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
                className="min-h-[44px] text-white hover:bg-white/10 hover:text-white"
                onClick={() => setView('admin-dashboard')}
              >
                <LayoutDashboard className="h-4 w-4 ml-1" />
                لوحة التحكم
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] border-white/30 text-white hover:bg-white/10 hover:text-white"
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
          {youtubeLink && (
            <a
              href={youtubeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] text-white/70 hover:text-red-400 transition-colors"
              title="YouTube"
            >
              <Youtube className="h-4 w-4" />
            </a>
          )}

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] text-white hover:bg-white/10"
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
            className="md:hidden min-h-[44px] min-w-[44px] text-white hover:bg-white/10"
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

      {/* Mobile Menu - transparent dark when on landing */}
      {mobileMenu && (
        <div className="md:hidden border-t border-white/10 bg-[#0a2e2f]/95 backdrop-blur-md px-4 py-3 space-y-2">
          {currentStudent ? (
            <>
              <p className="text-sm text-white/70 py-2">
                أهلاً بـ{' '}
                <span className="font-semibold text-white">
                  {currentStudent.name}
                </span>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full min-h-[44px] border-white/30 text-white hover:bg-white/10 hover:text-white"
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
                className="w-full min-h-[44px] justify-start text-white hover:bg-white/10 hover:text-white"
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
                className="w-full min-h-[44px] border-white/30 text-white hover:bg-white/10 hover:text-white"
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
                className="w-full min-h-[44px] bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold shadow-md"
                onClick={handleLoginClick}
              >
                <LogIn className="h-4 w-4 ml-1" />
                سجل دخولك
              </Button>
              <Button
                size="sm"
                className="w-full min-h-[44px] bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold shadow-md"
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
    </header>
  )
}
