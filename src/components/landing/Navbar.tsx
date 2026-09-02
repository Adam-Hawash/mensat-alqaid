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
} from 'lucide-react'
import { toast } from 'sonner'

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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
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
                className="min-h-[44px] text-foreground"
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
                className="min-h-[44px] text-foreground"
                onClick={() => setView('admin-dashboard')}
              >
                <LayoutDashboard className="h-4 w-4 ml-1" />
                لوحة التحكم
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] text-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 ml-1" />
                خروج
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] text-foreground"
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
              className="min-h-[44px] min-w-[44px] text-foreground"
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
            className="md:hidden min-h-[44px] min-w-[44px] text-foreground"
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

      {/* Mobile Menu */}
      {mobileMenu && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 space-y-2">
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
                className="w-full min-h-[44px] text-foreground"
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
                className="w-full min-h-[44px] justify-start text-foreground"
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
                className="w-full min-h-[44px] text-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 ml-1" />
                خروج
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="w-full min-h-[44px] text-foreground"
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
    </header>
  )
}
