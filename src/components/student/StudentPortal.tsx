'use client'

import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Video, ClipboardList, FileText, Megaphone, MessageSquare, Send,
  LogOut, Loader2, FileDown, Bell, PlayCircle, CheckCircle2,
  BookOpen, Target, TrendingUp, GraduationCap, ChevronLeft, ExternalLink,
  User, Phone, Award, Maximize, Minimize, Lock, X,
} from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import type { Video as VideoType, Homework, Exam, Announcement, Discussion, ExamResult } from '@/stores/app-store'

/* ========== SHUFFLE UTILITIES (per-student) ========== */
function createRng(seed: string) {
  var hash = 0
  for (var i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return function() {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff
    return hash / 0x7fffffff
  }
}

function shuffleArray(arr: any[], rng: () => number) {
  var a = arr.slice()
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1))
    var tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

function cleanQuestionText(text: string) {
  var cleaned = text
  // Remove leading Arabic ordinals: السؤال الأول, etc
  var ordinals = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحاديعر', 'الثانيعر']
  for (var oi = 0; oi < ordinals.length; oi++) {
    cleaned = cleaned.replace(new RegExp('^[\s]*(?:[السؤال]|[سؤال])?\s*' + ordinals[oi] + '[:\s.\)-]*', ''), '')
  }
  // Remove question prefixes
  cleaned = cleaned.replace(/^(?:Question|question)\s*\d+[:\s.\)-]*/, '')
  // Remove leading number followed by dot/paren/dash
  cleaned = cleaned.replace(/^\d+[\s]*[.)\-][\s]*/, '')
  // Remove trailing number
  cleaned = cleaned.replace(/[\s]+\d+[\s]*$/, '')
  return cleaned.trim()
}

function shuffleQuestionsForStudent(questions: any[], studentId: string, itemId: string) {
  var rng = createRng(studentId + ':' + itemId)
  var indices = questions.map(function(_, i) { return i })
  var shuffledIndices = shuffleArray(indices, rng)
  var result: any[] = []
  for (var di = 0; di < shuffledIndices.length; di++) {
    var oi = shuffledIndices[di]
    var q = questions[oi]
    var optIndices = q.options.map(function(_, i) { return i })
    var shuffledOptIndices = shuffleArray(optIndices, rng)
    var questionText = cleanQuestionText(q.question || q.q)
    result.push({
      question: questionText,
      options: shuffledOptIndices.map(function(optIdx) { return q.options[optIdx] }),
      _origIdx: oi,
      _optMap: shuffledOptIndices,
      _originalOptions: q.options.slice(),
      _correctOrig: q.correct,
    })
  }
  return result
}

export function StudentPortal() {
  const { currentStudent, logout } = useAppStore()
  const [dashboardData, setDashboardData] = useState<{
    videos: VideoType[]
    homework: Homework[]
    exams: Exam[]
    announcements: Announcement[]
    examResults: ExamResult[]
    watchedIds: Set<string>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFullPortal, setShowFullPortal] = useState(false)

  const grade = currentStudent?.grade || ''
  const studentId = currentStudent?.id || ''

  useEffect(() => {
    if (!grade || !studentId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        var timeout = function(url, ms) {
          return Promise.race([
            fetch(url).then(function(r) { return r.json() }),
            new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')) }, ms) })
          ])
        }
        var g = encodeURIComponent(grade)
        var results = await Promise.all([
          timeout('/api/videos?grade=' + g + '&pageSize=100', 15000),
          timeout('/api/homework?grade=' + g + '&pageSize=50', 15000),
          timeout('/api/exams?grade=' + g + '&pageSize=50', 15000),
          timeout('/api/announcements?grade=' + g + '&pageSize=10', 15000),
          timeout('/api/exam-results?grade=' + g, 15000),
          timeout('/api/activities?studentId=' + studentId + '&action=watched_video&pageSize=200', 15000),
        ])
        if (cancelled) return
        setDashboardData({
          videos: (results[0] && results[0].videos) || [],
          homework: (results[1] && results[1].homework) || [],
          exams: (results[2] && results[2].exams) || [],
          announcements: (results[3] && results[3].announcements) || [],
          examResults: (results[4] && results[4].results) || [],
          watchedIds: new Set<string>((results[5] && results[5].activities || []).map(function(a) { return (a.details || '').replace('Watched: ', '') })),
        })
      } catch { /* silent */ }
      if (!cancelled) setLoading(false)
    })()
    return function() { cancelled = true }
  }, [grade, studentId])

  const stats = useMemo(() => {
    if (!dashboardData) return { completedLessons: 0, pendingHomework: 0, lastScore: null, progress: 0, lastVideo: null, upcomingTasks: [] as any[] }
    const { videos, homework, exams, examResults, watchedIds, announcements } = dashboardData
    const completedLessons = watchedIds.size
    const pendingHomework = homework.length
    const lastScore = examResults.length > 0 ? examResults[0] : null
    const progress = videos.length > 0 ? Math.round((watchedIds.size / videos.length) * 100) : 0
    const lastVideo = videos.find(v => !watchedIds.has(v.id)) || videos[0] || null
    const upcomingTasks: any[] = []
    homework.slice(0, 2).forEach(hw => upcomingTasks.push({ type: 'homework', title: hw.title, icon: ClipboardList, color: 'text-blue-500' }))
    exams.slice(0, 2).forEach(ex => upcomingTasks.push({ type: 'exam', title: ex.title, icon: FileText, color: 'text-orange-500' }))
    if (lastVideo && !watchedIds.has(lastVideo.id)) upcomingTasks.push({ type: 'lesson', title: lastVideo.title, icon: Video, color: 'text-purple-500' })
    if (announcements.length > 0) upcomingTasks.push({ type: 'important', title: announcements[0].title, icon: Bell, color: 'text-red-500' })
    return { completedLessons, pendingHomework, lastScore, progress, lastVideo, upcomingTasks: upcomingTasks.slice(0, 4) }
  }, [dashboardData])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  )

  if (showFullPortal) {
    return <FullPortal initialData={dashboardData!} onBack={() => setShowFullPortal(false)} />
  }

  return (
    <div className="flex-1 py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl">
        {/* Welcome Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold">
              مرحباً، {currentStudent?.name} 👋
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4" />
              <span>{grade}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 ml-1" />
            خروج
          </Button>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
          <StatCard icon={CheckCircle2} label="الدروس المكتملة" value={stats.completedLessons} color="text-emerald-500 bg-emerald-500/10" />
          <StatCard icon={ClipboardList} label="الواجبات المطلوبة" value={stats.pendingHomework} color="text-blue-500 bg-blue-500/10" />
          <StatCard icon={Target} label="آخر درجة" value={stats.lastScore ? `${stats.lastScore.score}/${stats.lastScore.maxScore}` : '—'} color="text-orange-500 bg-orange-500/10" />
          <StatCard icon={TrendingUp} label="نسبة التقدم" value={`${stats.progress}%`} color="text-purple-500 bg-purple-500/10" />
        </div>

        {/* Progress Bar */}
        <Card className="mb-8">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">تقدمك في الكورس</span>
              <span className="text-sm text-primary font-bold">{stats.progress}%</span>
            </div>
            <Progress value={stats.progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Continue Learning */}
        {stats.lastVideo && (
          <Card className="mb-8 border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <PlayCircle className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-lg">متابعة التعلم</h2>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {stats.lastVideo.thumbnail ? (
                  <div className="w-full sm:w-40 aspect-video rounded-lg overflow-hidden bg-muted shrink-0 relative">
                    <Image src={stats.lastVideo.thumbnail} alt="" fill className="object-cover" sizes="300px" unoptimized />
                  </div>
                ) : stats.lastVideo.filePath ? (
                  <div className="w-full sm:w-40 aspect-video rounded-lg overflow-hidden bg-black/80 flex items-center justify-center shrink-0">
                    <Video className="h-10 w-10 text-white/60" />
                  </div>
                ) : null}
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="font-semibold truncate">{stats.lastVideo.title}</p>
                  <p className="text-sm text-muted-foreground">{stats.lastVideo.grade}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-[200px]">
                      <Progress value={stats.progress} className="h-1.5" />
                    </div>
                    <span className="text-xs text-muted-foreground">{stats.progress}% مشاهدة</span>
                  </div>
                  <Button size="sm" className="mt-1" onClick={() => setShowFullPortal(true)}>
                    متابعة <ChevronLeft className="h-4 w-4 mr-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Tasks */}
        <Card className="mb-8">
          <CardContent className="p-4 sm:p-6">
            <h2 className="font-bold text-lg mb-4">المهام القادمة</h2>
            <div className="space-y-3">
              {stats.upcomingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد مهام قادمة 🎉</p>
              ) : (
                stats.upcomingTasks.map((task, i) => {
                  const Icon = task.icon
                  const typeLabels: Record<string, string> = { homework: 'واجب', exam: 'Quiz', lesson: 'درس جديد', important: 'مهم' }
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${task.color} bg-current/10`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">{typeLabels[task.type] || task.type}</Badge>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Notifications */}
        {dashboardData && dashboardData.announcements.length > 0 && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="font-bold">إشعارات مهمة</h2>
                <Badge variant="destructive" className="text-[10px]">{dashboardData.announcements.length} جديد</Badge>
              </div>
              <div className="space-y-2">
                {dashboardData.announcements.slice(0, 3).map((ann, i) => (
                  <div key={ann.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <Megaphone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ann.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{ann.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Browse All Button */}
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => setShowFullPortal(true)} className="gap-2">
            <BookOpen className="h-4 w-4" />
            تصفح جميع الدروس والمحتوى
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold truncate">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ========== FULL PORTAL (all tabs) ========== */
function FullPortal({ initialData, onBack }: { initialData: PortalData; onBack: () => void }) {
  return <FullPortalContent initialData={initialData} onBack={onBack} />
}

type PortalData = {
  videos: VideoType[]
  homework: Homework[]
  exams: Exam[]
  announcements: Announcement[]
  examResults: ExamResult[]
  watchedIds: Set<string>
}

function FullPortalContent({ initialData, onBack }: { initialData: PortalData; onBack: () => void }) {
  const { currentStudent } = useAppStore()
  const grade = currentStudent?.grade || ''
  const studentId = currentStudent?.id || ''
  const [activeTab, setActiveTab] = useState('videos')

  return (
    <div className="flex-1 py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />الرئيسية</Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={useAppStore.getState().logout}>
            <LogOut className="h-4 w-4 ml-1" />خروج
          </Button>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-1 flex-wrap bg-muted/50 p-1 rounded-lg mb-6">
          {[
            { key: 'videos', icon: Video, label: 'الدروس' },
            { key: 'homework', icon: ClipboardList, label: 'الواجبات' },
            { key: 'exams', icon: FileText, label: 'الامتحانات' },
            { key: 'announcements', icon: Megaphone, label: 'الإعلانات' },
            { key: 'discussions', icon: MessageSquare, label: 'النقاشات' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'videos' && <VideosTab videos={initialData.videos} watchedIds={initialData.watchedIds} studentId={studentId} grade={grade} />}
        {activeTab === 'homework' && <HomeworkTab homework={initialData.homework} studentId={studentId} />}
        {activeTab === 'exams' && <ExamsTab exams={initialData.exams} results={initialData.examResults} studentId={studentId} />}
        {activeTab === 'announcements' && <AnnouncementsTab announcements={initialData.announcements} />}
        {activeTab === 'discussions' && <DiscussionsTab grade={grade} studentId={studentId} studentName={currentStudent?.name || ''} />}
      </div>
    </div>
  )
}

/* ========== VIDEOS TAB ========== */
function VideosTab({ videos, watchedIds, studentId, grade }: { videos: VideoType[]; watchedIds: Set<string>; studentId: string; grade: string }) {
  const { setView, setPendingPaymentVideo } = useAppStore()
  const [localWatched, setLocalWatched] = useState(watchedIds)

  const trackVideoWatch = (videoId: string) => {
    if (!studentId || localWatched.has(videoId)) return
    setLocalWatched(prev => new Set([...prev, videoId]))
    fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, action: 'watched_video', details: `Watched: ${videoId}` }),
    }).catch(() => {})
  }

  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/)
    return match ? match[1] : null
  }

  const getYouTubeThumbnail = (url: string) => {
    const id = getYouTubeId(url)
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
  }

  if (videos.length === 0) return <EmptyState message="لا توجد دروس حالياً" />

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {videos.map((video) => {
        const ytId = getYouTubeId(video.url)
        const isVideoFile = video.filePath && (video.fileType?.startsWith('video/') || video.filePath.match(/\.(mp4|webm|mov|avi)$/i))
        const isWatched = localWatched.has(video.id)
        const thumbSrc = video.thumbnail || getYouTubeThumbnail(video.url) || null
        const needsPay = (video.price || 0) > 0

        return (
          <Card key={video.id} className={`overflow-hidden transition-all ${isWatched ? 'border-emerald-500/30' : ''}`}>
            <div className="relative aspect-video bg-black">
              {needsPay ? (
                <div className="w-full h-full relative">
                  {thumbSrc ? (
                    <Image src={thumbSrc} alt={video.title} fill className="object-cover blur-sm" sizes="(max-width: 640px) 100vw, 50vw" unoptimized loading="eager" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-black/80 to-black" />
                  )}
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3 z-20">
                    <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <Lock className="h-7 w-7 text-white" />
                    </div>
                    <Badge className="text-lg px-4 py-1.5 bg-amber-500 text-white">
                      {video.price} ج.م
                    </Badge>
                    <Button
                      className="mt-1"
                      onClick={() => {
                        setPendingPaymentVideo({
                          id: video.id,
                          title: video.title,
                          price: video.price || 0,
                          grade: grade,
                        })
                        setView('student-payment')
                      }}
                    >
                      ادفع الآن
                    </Button>
                  </div>
                </div>
              ) : ytId ? (
                /* YouTube: controls=0 يخفي الـ 3-dot menu بالكامل */
                <div className="video-protected w-full h-full" onClick={() => trackVideoWatch(video.id)}>
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}?modestbranding=1&rel=0&playsinline=1&controls=0&showinfo=0&iv_load_policy=3`}
                    title={video.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : isVideoFile ? (
                /* MP4: كنترولات مخصصة — مفيش controls يعني مفيش 3-dot menu */
                <CustomVideoPlayer
                  videoId={video.id}
                  src={video.filePath}
                  poster={thumbSrc || undefined}
                  studentId={studentId}
                  onWatch={() => {
                    trackVideoWatch(video.id)
                    setLocalWatched(prev => new Set([...prev, video.id]))
                  }}
                />
              ) : thumbSrc ? (
                <div className="w-full h-full relative">
                  <Image src={thumbSrc} alt={video.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" unoptimized loading="eager" fetchPriority="high" />
                </div>
              ) : video.url ? (
                <a href={video.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full h-full text-white/70 hover:text-white transition-colors">
                  <ExternalLink className="h-6 w-6" />
                  <span className="text-sm">فتح الرابط</span>
                </a>
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <Video className="h-10 w-10 text-white/30" />
                </div>
              )}
              {isWatched && (
                <div className="absolute top-2 right-2 z-30">
                  <Badge className="bg-emerald-500 text-white text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" /> تمت المشاهدة
                  </Badge>
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <h3 className="font-semibold text-sm truncate">{video.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{new Date(video.createdAt).toLocaleDateString('ar-EG')}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ========== CUSTOM VIDEO PLAYER (لا يوجد 3-dot menu / لا يوجد تحميل) ========== */
function CustomVideoPlayer({ videoId, src, poster, studentId, onWatch }: {
  videoId: string
  src: string
  poster?: string
  studentId: string
  onWatch: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const hideTimerRef = useRef<any>(null)

  useEffect(() => {
    var onFsChange = function() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    return function() {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
    }
  }, [])

  // إخفاء الكنترولات بعد 3 ثواني من التشغيل
  useEffect(() => {
    if (playing) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000)
    } else {
      setShowControls(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }
  }, [playing, showControls])

  var togglePlay = function(e?: React.MouseEvent | React.TouchEvent) {
    if (e) { e.preventDefault(); e.stopPropagation() }
    var v = videoRef.current
    if (!v) return
    if (v.paused) { v.play().catch(function(){}) } else { v.pause() }
  }

  var handleTimeUpdate = function() {
    var v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
    if (v.buffered.length > 0 && v.duration > 0) {
      setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100)
    }
    if (v.duration && studentId && Math.floor(v.currentTime) % 5 === 0 && v.currentTime > 0) {
      fetch('/api/video-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, videoId, watchedSeconds: v.currentTime, totalSeconds: v.duration }),
      }).catch(function(){})
    }
  }

  var handleEnded = function() {
    setPlaying(false)
    setShowControls(true)
    if (studentId) {
      fetch('/api/video-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, videoId, watchedSeconds: 999999, totalSeconds: 1 }),
      }).catch(function(){})
      onWatch()
    }
  }

  var handleSeek = function(e: React.MouseEvent | React.TouchEvent) {
    var bar = progressRef.current
    var v = videoRef.current
    if (!bar || !v || !v.duration) return
    var rect = bar.getBoundingClientRect()
    var clientX = 'touches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX
    var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    v.currentTime = ratio * v.duration
  }

  var handleFullscreen = function(e: React.MouseEvent | React.TouchEvent) {
    if (e) { e.preventDefault(); e.stopPropagation() }
    // لو Already في fullscreen → خرج
    if (document.fullscreenElement) { document.exitFullscreen().catch(function(){}) ; return }
    if ((document as any).webkitFullscreenElement) { (document as any).webkitExitFullscreen() ; return }
    var v = videoRef.current
    if (!v) return
    v.play().then(function() {
      var vv = v as any
      if (vv.webkitEnterFullscreen) {
        vv.webkitEnterFullscreen()
      } else if (vv.parentElement && vv.parentElement.requestFullscreen) {
        vv.parentElement.requestFullscreen().catch(function(){})
      } else if (vv.requestFullscreen) {
        vv.requestFullscreen().catch(function(){})
      }
    }).catch(function(){})
  }

  var formatTime = function(sec: number) {
    if (!sec || !isFinite(sec)) return '0:00'
    var m = Math.floor(sec / 60)
    var s = Math.floor(sec % 60)
    return m + ':' + String(s).padStart(2, '0')
  }

  var progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="video-protected w-full h-full relative select-none"
      onClick={togglePlay}
      onTouchStart={function() { setShowControls(true) }}
      onContextMenu={function(e) { e.preventDefault() }}
    >
      {/* فيديو بدون controls — مفيش 3-dot menu أصلاً */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        onPlay={function() { setPlaying(true) }}
        onPause={function() { setPlaying(false) }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={function() { if (videoRef.current) setDuration(videoRef.current.duration) }}
      />

      {/* أيقونة Play في النصف */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl">
            <svg className="h-8 w-8 text-gray-800" style={{ marginLeft: '3px' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      )}

      {/* شريط الكنترولات السفلي */}
      <div
        className={
          'absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ' +
          (showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none')
        }
        onClick={function(e) { e.stopPropagation() }}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="w-full h-1 bg-white/30 cursor-pointer group"
          onClick={handleSeek}
          onTouchEnd={function(e) { e.preventDefault(); e.stopPropagation(); handleSeek(e) }}
        >
          <div className="absolute top-0 left-0 h-full bg-white/40 pointer-events-none" style={{ width: buffered + '%' }} />
          <div className="absolute top-0 left-0 h-full bg-primary group-hover:h-1.5 transition-all pointer-events-none" style={{ width: progressPercent + '%' }} />
        </div>

        {/* أزرار الكنترول */}
        <div className="flex items-center gap-1 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
          {/* Play / Pause */}
          <button
            className="w-9 h-9 flex items-center justify-center text-white hover:text-primary transition-colors shrink-0"
            onClick={togglePlay}
            onTouchEnd={function(e) { e.preventDefault(); e.stopPropagation(); togglePlay() }}
          >
            {playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <span className="text-white text-xs tabular-nums" dir="ltr">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* زرار التكبير جنب الوقت */}
          <button
            className="w-9 h-9 flex items-center justify-center text-white hover:text-primary transition-colors shrink-0"
            onClick={handleFullscreen}
            onTouchEnd={function(e) { e.preventDefault(); e.stopPropagation(); handleFullscreen(e) }}
            aria-label="تكبير"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ========== HOMEWORK TAB ========== */
function HomeworkTab({ homework, studentId }: { homework: Homework[]; studentId: string }) {
  var store = useAppStore()
  var logout = store.logout
  var [expandedHw, setExpandedHw] = useState<string | null>(null)
  var [hwAnswers, setHwAnswers] = useState<Record<string, Record<number, number>>>({})
  var [hwSubmitting, setHwSubmitting] = useState<string | null>(null)
  var [submittedMsg, setSubmittedMsg] = useState<string | null>(null)
  var [submittedHwIds, setSubmittedHwIds] = useState<Set<string>>(new Set())
  var [shuffledHwQ, setShuffledHwQ] = useState<Record<string, any[]>>({})
  var [hwResultLoading, setHwResultLoading] = useState(false)
  var [hwResultScore, setHwResultScore] = useState<number | null>(null)
  var [hwResultMaxScore, setHwResultMaxScore] = useState<number | null>(null)
  var [hwResultDetails, setHwResultDetails] = useState<any[]>([])

  var handleExpandHw = function(hwId: string) {
    if (expandedHw === hwId) {
      setExpandedHw(null)
      return
    }
    var hw = homework.find(function(h) { return h.id === hwId })
    if (!hw) return
    try {
      var mcq = (hw as any).questions ? JSON.parse((hw as any).questions) : []
      if (Array.isArray(mcq) && mcq.length > 0) {
        var shuffled = shuffleQuestionsForStudent(mcq, studentId, hwId)
        setShuffledHwQ(function(prev) { var a = { ...prev }; a[hwId] = shuffled; return a })
      }
    } catch { /* ignore */ }
    setExpandedHw(hwId)
  }

  var handleHwSubmit = function(hwId: string) {
    var myAnswers = hwAnswers[hwId] || {}
    if (Object.keys(myAnswers).length === 0) return
    setHwSubmitting(hwId)
    var serverAnswers: Record<string, number> = {}
    var shQ = shuffledHwQ[hwId] || []
    var keys = Object.keys(myAnswers)
    for (var ki = 0; ki < keys.length; ki++) {
      var di = Number(keys[ki])
      var origIdx = shQ[di]._origIdx
      var origOpt = shQ[di]._optMap[myAnswers[di]]
      serverAnswers[String(origIdx)] = origOpt
    }
    fetch('/api/homework/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: studentId, homeworkId: hwId, answers: serverAnswers }),
    })
    .then(function(r) { return r.json() })
    .then(function(data) {
      setSubmittedHwIds(function(prev) { var s = new Set(prev); s.add(hwId); return s })
      setSubmittedMsg('تم تقديم هذا الواجب بنجاح')
      setHwResultLoading(true)
      setTimeout(function() {
        setHwResultScore(data.result ? data.result.score : null)
        setHwResultMaxScore(data.result ? data.result.maxScore : null)
        setHwResultDetails(data.details || [])
        setHwResultLoading(false)
      }, 3000)
    })
    .catch(function() {
      setSubmittedHwIds(function(prev) { var s = new Set(prev); s.add(hwId); return s })
      setSubmittedMsg('تم تقديم هذا الواجب بنجاح')
      setHwResultLoading(false)
    })
    .finally(function() { setHwSubmitting(null) })
  }

  // Post-submission: show score and wrong answers
  if (submittedMsg) {
    if (hwResultLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold">{submittedMsg}</h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">جاري تحميل الدرجة...</p>
          </div>
        </div>
      )
    }
    var wrongQuestions = (hwResultDetails || []).filter(function(d) { return !d.correct })
    return (
      <div className="space-y-4 py-4">
        <div className="flex flex-col items-center justify-center text-center space-y-3 pb-4">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold">{submittedMsg}</h2>
          {hwResultScore !== null && (
            <div className="space-y-1">
              <p className="text-3xl font-bold text-primary">{hwResultScore}/{hwResultMaxScore}</p>
              <p className="text-sm text-muted-foreground">درجتك</p>
            </div>
          )}
        </div>
        {wrongQuestions.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-red-500 flex items-center gap-2">
              <X className="h-4 w-4" />
              الأسئلة الخاطئة ({wrongQuestions.length})
            </h3>
            {wrongQuestions.map(function(wq, wi) {
              return (
                <Card key={wi} className="border-red-200 dark:border-red-900/50">
                  <CardContent className="p-4 space-y-2">
                    <p className="font-medium text-sm">{wi + 1}. {wq.question}</p>
                    <div className="text-sm space-y-1">
                      <p className="text-red-500">إجابتك: {wq.studentAnswer}</p>
                      <p className="text-emerald-600">الإجابة الصحيحة: {wq.correctAnswer}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
        {wrongQuestions.length === 0 && hwResultScore !== null && (
          <div className="text-center">
            <p className="text-emerald-600 font-medium">أحسنت! جميع الإجابات صحيحة</p>
          </div>
        )}
        <div className="flex justify-center mt-6">
          <Button variant="outline" className="gap-2" onClick={function() { setSubmittedMsg(null); setExpandedHw(null); setHwAnswers(function(prev) { var a = { ...prev }; return a }); }}>
            <ChevronLeft className="h-4 w-4" />
            العودة إلى صفحتك
          </Button>
        </div>
      </div>
    )
  }

  if (homework.length === 0) return <EmptyState message="لا توجد واجبات حالياً" />
  return (
    <div className="space-y-3">
      {homework.map(function(hw) {
        var mcqCount = 0
        try { if ((hw as any).questions) { var parsed = JSON.parse((hw as any).questions); mcqCount = parsed.length } } catch {}
        var hasMCQ = mcqCount > 0
        var isSubmitted = submittedHwIds.has(hw.id)
        var isExpanded = expandedHw === hw.id && !isSubmitted
        var myAnswers = hwAnswers[hw.id] || {}
        var shQ = shuffledHwQ[hw.id] || []

        return (
          <Card key={hw.id} className={isSubmitted ? 'border-emerald-500/30' : (hasMCQ ? 'cursor-pointer' : '')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3" onClick={hasMCQ && !isSubmitted ? function() { handleExpandHw(hw.id) } : undefined}>
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={"h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 " + (hasMCQ ? 'bg-emerald-500/10' : 'bg-blue-500/10')}>
                    <ClipboardList className={"h-4 w-4 " + (hasMCQ ? 'text-emerald-500' : 'text-blue-500')} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-semibold text-sm">{hw.title}</h3>
                    {hw.content && <p className="text-xs text-muted-foreground line-clamp-2">{hw.content}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[10px] text-muted-foreground">{new Date(hw.createdAt).toLocaleDateString('ar-EG')}</p>
                      {isSubmitted ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">تم تقديم هذا الواجب</Badge>
                      ) : hasMCQ ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">{mcqCount} سؤال</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                {hw.filePath && !hasMCQ && <FileAttachment filePath={hw.filePath} fileType={hw.fileType} />}
                {hasMCQ && <ChevronLeft className={"h-4 w-4 text-muted-foreground transition-transform shrink-0 mt-1 " + (isExpanded ? 'rotate-90' : '')} />}
              </div>

              {isExpanded && hasMCQ && shQ.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  {shQ.map(function(q, qi) {
                    return (
                      <div key={qi} className="space-y-2 rounded-lg p-2">
                        <p className="font-medium text-sm flex-1">{qi + 1}. {q.question}</p>
                        <div className="space-y-1.5">
                          {q.options.map(function(opt, oi) {
                            var isSelected = myAnswers[qi] === oi
                            return (
                              <button
                                key={oi}
                                onClick={function() { setHwAnswers(function(prev) { var a = { ...prev }; a[hw.id] = { ...(a[hw.id] || {}), [qi]: oi }; return a }) }}
                                className={"w-full text-right p-3 rounded-lg border text-sm transition-colors " + (
                                  isSelected ? 'border-primary bg-primary/10 text-primary font-medium' :
                                  'border-border hover:bg-muted/50'
                                )}
                              >
                                <span className="ml-2">{String.fromCharCode(65 + oi)})</span>{opt}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  <Button size="sm" onClick={function() { handleHwSubmit(hw.id) }} disabled={Object.keys(myAnswers).length === 0 || hwSubmitting === hw.id}>
                    {hwSubmitting === hw.id ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
                    تسليم الإجابات ({Object.keys(myAnswers).length}/{shQ.length})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ========== EXAMS TAB ========== */
function ExamsTab({ exams, results, studentId }: { exams: Exam[]; results: ExamResult[]; studentId: string }) {
  var store = useAppStore()
  var logout = store.logout
  var [takingExam, setTakingExam] = useState<string | null>(null)
  var [answers, setAnswers] = useState<Record<number, number>>({})
  var [submitting, setSubmitting] = useState(false)
  var [examQuestions, setExamQuestions] = useState<any[]>([])
  var [submittedMsg, setSubmittedMsg] = useState<string | null>(null)
  var [submittedExamIds, setSubmittedExamIds] = useState<Set<string>>(new Set())
  var [lockedOut, setLockedOut] = useState(false)

  // Lockout: detect tab switch during exam
  useEffect(function() {
    if (!takingExam) return
    var handler = function() {
      if (document.hidden) {
        setLockedOut(true)
      }
    }
    document.addEventListener('visibilitychange', handler)
    return function() { document.removeEventListener('visibilitychange', handler) }
  }, [takingExam])

  if (exams.length === 0) return <EmptyState message="لا توجد امتحانات حالياً" />

  // Post-submission: exam results are hidden from student
  if (submittedMsg) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold">تم تقديم الامتحان</h2>
        <Button variant="outline" className="mt-4 gap-2" onClick={function() { setSubmittedMsg(null); setTakingExam(null); setAnswers({}); setExamQuestions([]); setLockedOut(false) }}>
          <ChevronLeft className="h-4 w-4" />
          العودة إلى صفحتك
        </Button>
      </div>
    )
  }

  // Exam Taking Mode
  if (takingExam) {
    var exam = exams.find(function(e) { return e.id === takingExam })
    if (!exam || examQuestions.length === 0) {
      setTakingExam(null)
      return null
    }
    // Lockout screen
    if (lockedOut) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <X className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold">تم إلغاء الامتحان</h2>
          <p className="text-sm text-muted-foreground">لقد غادرت صفحة الامتحان</p>
          <Button variant="outline" onClick={function() { setTakingExam(null); setAnswers({}); setExamQuestions([]); setLockedOut(false) }}>رجوع للامتحانات</Button>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{exam.title}</h3>
          <Button variant="outline" size="sm" onClick={function() { setTakingExam(null); setAnswers({}); setExamQuestions([]); setLockedOut(false) }}>رجوع</Button>
        </div>
        {examQuestions.map(function(q, qi) {
          return (
            <Card key={qi}>
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-sm">{qi + 1}. {q.question}</p>
                <div className="space-y-2">
                  {q.options.map(function(opt, oi) {
                    return (
                      <button
                        key={oi}
                        onClick={function() { setAnswers(function(prev) { var a = { ...prev }; a[qi] = oi; return a }) }}
                        className={"w-full text-right p-3 rounded-lg border text-sm transition-colors " + (answers[qi] === oi ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-muted/50')}
                      >
                        <span className="ml-2 font-bold">{String.fromCharCode(65 + oi)}.</span> {opt}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
        <Button
          className="w-full"
          disabled={Object.keys(answers).length < examQuestions.length || submitting}
          onClick={function() {
            setSubmitting(true)
            var serverAnswers: Record<string, number> = {}
            var keys = Object.keys(answers)
            for (var ki = 0; ki < keys.length; ki++) {
              var di = Number(keys[ki])
              var origIdx = examQuestions[di]._origIdx
              var origOpt = examQuestions[di]._optMap[answers[di]]
              serverAnswers[String(origIdx)] = origOpt
            }
            fetch('/api/exams/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ studentId: studentId, examId: takingExam, answers: serverAnswers }),
            })
            .then(function(r) { return r.json() })
            .then(function(data) {
              setSubmittedExamIds(function(prev) { var s = new Set(prev); s.add(takingExam); return s })
              setSubmittedMsg('تم تقديم هذا الامتحان')
            })
            .catch(function() {
              setSubmittedExamIds(function(prev) { var s = new Set(prev); s.add(takingExam); return s })
              setSubmittedMsg('تم تقديم هذا الامتحان')
            })
            .finally(function() { setSubmitting(false) })
          }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تقديم الامتحان (' + Object.keys(answers).length + '/' + examQuestions.length + ')'}
        </Button>
      </div>
    )
  }

  // Exam List Mode
  return (
    <div className="space-y-3">
      {exams.map(function(exam) {
        var examResult = results.find(function(r) { return r.examId === exam.id })
        var isSubmitted = !!(examResult || submittedExamIds.has(exam.id))
        var hasMCQ = false
        try { if ((exam as any).questions) { var parsed = JSON.parse((exam as any).questions); hasMCQ = parsed.length > 0 } } catch {}
        return (
          <Card key={exam.id} className={isSubmitted ? 'border-emerald-500/30' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="h-4 w-4 text-orange-500" />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <h3 className="font-semibold text-sm">{exam.title}</h3>
                    {isSubmitted ? (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        تم تقديم هذا الامتحان
                      </Badge>
                    ) : hasMCQ ? (
                      <Button size="sm" onClick={function() {
                        try {
                          var parsed = JSON.parse((exam as any).questions)
                          var shuffled = shuffleQuestionsForStudent(parsed, studentId, exam.id)
                          setExamQuestions(shuffled)
                          setTakingExam(exam.id)
                          setAnswers({})
                          setLockedOut(false)
                        } catch { toast.error('خطأ في تحميل الأسئلة') }
                      }}>ابدأ الامتحان</Button>
                    ) : (
                      <Badge variant="secondary" className="text-xs">لم يتم بعد</Badge>
                    )}
                    <p className="text-[10px] text-muted-foreground">{new Date(exam.createdAt).toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>
                {exam.filePath && <FileAttachment filePath={exam.filePath} fileType={exam.fileType} />}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ========== ANNOUNCEMENTS TAB ========== */
function AnnouncementsTab({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) return <EmptyState message="لا توجد إعلانات حالياً" />
  return (
    <div className="space-y-3">
      {announcements.map((ann) => (
        <Card key={ann.id} className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Megaphone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 space-y-1">
                <h3 className="font-semibold text-sm">{ann.title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(ann.createdAt).toLocaleDateString('ar-EG')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ========== DISCUSSIONS TAB ========== */
function DiscussionsTab({ grade, studentId, studentName }: { grade: string; studentId: string; studentName: string }) {
  const { currentStudent } = useAppStore()
  const [items, setItems] = useState<Discussion[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const fetchDiscussions = async () => {
    try {
      const res = await fetch(`/api/discussions?grade=${encodeURIComponent(grade)}&pageSize=100`)
      const data = await res.json()
      setItems(data.discussions || [])
    } catch { toast.error('خطأ في تحميل النقاشات') }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        var res = await Promise.race([
          fetch('/api/discussions?grade=' + encodeURIComponent(grade) + '&pageSize=100').then(function(r) { return r.json() }),
          new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')) }, 15000) })
        ])
        if (!cancelled) setItems(res.discussions || [])
      } catch { if (!cancelled) toast.error('خطأ في تحميل النقاشات') }
      if (!cancelled) setLoading(false)
    })()
    return function() { cancelled = true }
  }, [grade])

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [items])

  const handleSend = async () => {
    if (!newMessage.trim()) return
    setSending(true)
    try {
      await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName: currentStudent?.name || studentName, grade, content: newMessage.trim(), isAdminReply: false }),
      })
      setNewMessage('')
      fetchDiscussions()
      toast.success('تم إرسال رسالتك')
    } catch { toast.error('خطأ في إرسال الرسالة') }
    setSending(false)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="اكتب رسالتك أو سؤالك هنا..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={sending || !newMessage.trim()} size="icon">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState message="ابدأ النقاش! اكتب أول رسالة" />
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
          {items.map((d) => {
            const isMe = d.studentId === (currentStudent?.id || studentId)
            const isAdmin = d.isAdminReply
            return (
              <div key={d.id} className={`flex ${isAdmin ? 'justify-start' : isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isAdmin ? 'bg-primary/15 dark:bg-primary/20 border border-primary/20 rounded-bl-md' :
                  isMe ? 'bg-primary text-primary-foreground rounded-bl-md' :
                  'bg-muted rounded-br-md'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-xs font-medium ${isAdmin ? 'text-primary' : isMe ? 'opacity-75' : 'text-foreground'}`}>{d.studentName}</p>
                    {isAdmin && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary">الأدمن</Badge>}
                  </div>
                  <p className="text-sm leading-relaxed">{d.content}</p>
                  <p className={`text-[10px] mt-1 ${isAdmin ? 'text-primary/60' : isMe ? 'opacity-60' : 'text-muted-foreground'}`}>{new Date(d.createdAt).toLocaleString('ar-EG')}</p>
                </div>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>
      )}
    </div>
  )
}

/* ========== SHARED COMPONENTS ========== */
function FileAttachment({ filePath, fileType }: { filePath: string; fileType: string }) {
  const isImage = fileType?.startsWith('image/')
  const isPdf = fileType === 'application/pdf'
  if (isImage) {
    return <Image src={filePath} alt="Attachment" width={48} height={48} className="max-h-12 rounded-lg border" unoptimized />
  }
  return (
    <a href={filePath} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs shrink-0">
      <FileDown className="h-4 w-4" />
      {isPdf ? 'PDF' : 'ملف'}
    </a>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}
