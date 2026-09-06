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
  BookOpen, Target, TrendingUp, GraduationCap, ChevronLeft,
  User, Phone, Award, Lock, X, ImagePlus, ListTodo,
} from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { ProtectedYouTubePlayer } from '@/components/student/ProtectedYouTubePlayer'
import { ProtectedFilePlayer } from '@/components/student/ProtectedFilePlayer'
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
    var qOpts = Array.isArray(q.options) ? q.options : []
    var optIndices = qOpts.map(function(_, i) { return i })
    var shuffledOptIndices = shuffleArray(optIndices, rng)
    var questionText = cleanQuestionText(q.question || q.q)
    result.push({
      question: questionText,
      options: shuffledOptIndices.map(function(optIdx) { return qOpts[optIdx] }),
      type: q.type,
      points: q.points,
      modelAnswer: q.modelAnswer,
      _origIdx: oi,
      _optMap: shuffledOptIndices,
      _originalOptions: qOpts.slice(),
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
          timeout('/api/exam-results?studentId=' + encodeURIComponent(studentId), 15000),
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
                {(stats.lastVideo.thumbnail || (stats.lastVideo as any).thumb) ? (
                  <div className="w-full sm:w-40 aspect-video rounded-lg overflow-hidden bg-muted shrink-0 relative">
                    <Image src={stats.lastVideo.thumbnail || (stats.lastVideo as any).thumb} alt="" fill className="object-cover" sizes="300px" unoptimized />
                  </div>
                ) : (stats.lastVideo as any).kind === 'file' || stats.lastVideo.filePath ? (
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
  const currentStudent = useAppStore(function (s) { return s.currentStudent })
  const studentName = currentStudent?.name || ''
  const studentPhone = currentStudent?.phone || ''
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

  // حماية الفيديو: السيرفر مبيرسلش url/filePath خلاص — بنعرف النوع من kind
  // والتشغيل بيتم عبر /api/video-play بس (توكن موقّع للملفات المرفوعة)
  const videoKind = (v: any): 'youtube' | 'file' | 'link' | 'none' => {
    if (v.kind) return v.kind
    if (v.url && /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/.test(v.url)) return 'youtube'
    if (v.filePath && /\.(mp4|webm|mov|avi)$/i.test(v.filePath)) return 'file'
    if (v.url) return 'link'
    return 'none'
  }

  if (videos.length === 0) return <EmptyState message="لا توجد دروس حالياً" />

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {videos.map((video) => {
        const kind = videoKind(video)
        const isWatched = localWatched.has(video.id)
        const thumbSrc = video.thumbnail || (video as any).thumb || null
        const needsPay = (video.price || 0) > 0

        return (
          <Card key={video.id} className={`overflow-hidden transition-all ${isWatched ? 'border-emerald-500/30' : ''}`}>
            <div className="relative aspect-video bg-black" onContextMenu={function (e) { e.preventDefault() }}>
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
              ) : kind === 'youtube' ? (
                /* يوتيوب محمي: الصورة المصغرة بس في الكارت — الـ ytId بيتجاب
                   لحظة التشغيل من بوابة /api/video-play وبعدها الـ iframe يظهر */
                <GuardedYouTubeCard
                  videoId={video.id}
                  title={video.title}
                  poster={thumbSrc || undefined}
                  studentId={studentId}
                  studentName={studentName}
                  studentPhone={studentPhone}
                  onWatch={() => {
                    trackVideoWatch(video.id)
                    setLocalWatched(prev => new Set([...prev, video.id]))
                  }}
                />
              ) : kind === 'file' ? (
                /* MP4 محمي: بيجيب رابط موقّع من /api/video-play — filePath الخام مش بيوصل أصلاً */
                <GatedVideoPlayer
                  videoId={video.id}
                  poster={thumbSrc || undefined}
                  studentId={studentId}
                  studentName={studentName}
                  studentPhone={studentPhone}
                  onWatch={() => {
                    trackVideoWatch(video.id)
                    setLocalWatched(prev => new Set([...prev, video.id]))
                  }}
                />
              ) : thumbSrc ? (
                <div className="w-full h-full relative">
                  <Image src={thumbSrc} alt={video.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" unoptimized loading="eager" fetchPriority="high" />
                </div>
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

/* ========== GUARDED YOUTUBE CARD — يوتيوب محمي ==========
 * الكارت بيعرض الصورة المصغرة من البروكسي (من غير أي معرف يوتيوب)،
 * ولما الطالب يدوس تشغيل بيجيب الـ ytId لحظتها من /api/video-play
 * (بوابة التشغيل الوحيدة) وبعدها الـ iframe بيظهر + ووترمارك اسمه ورقمه.
 * ======================================================== */
function GuardedYouTubeCard({ videoId, title, poster, studentId, studentName, studentPhone, onWatch }: {
  videoId: string
  title: string
  poster?: string
  studentId: string
  studentName?: string
  studentPhone?: string
  onWatch: () => void
}) {
  const [ytId, setYtId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  var openPlayer = function () {
    if (ytId || loading) return
    setLoading(true)
    fetch('/api/video-play?videoId=' + videoId + '&studentId=' + encodeURIComponent(studentId || ''))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d } }) })
      .then(function (res) {
        if (res.ok && res.d.isYouTube && res.d.ytId) {
          setYtId(res.d.ytId)
          onWatch()
        } else {
          setError(res.d.error || 'الفيديو مش متاح — لو دفعت تواصل مع الإدارة')
        }
        setLoading(false)
      })
      .catch(function () { setError('حصل خطأ في تشغيل الفيديو'); setLoading(false) })
  }

  return (
    <div
      className="video-protected w-full h-full relative select-none bg-black"
      onContextMenu={function (e) { e.preventDefault() }}
    >
      {ytId ? (
        /* مشغّل يوتيوب محمي — الووترمارك والتحكم جوه عنصر ملء الشاشة نفسه
           (الـ iframe الخام كان بيسيب الطالب يفتح fullscreen يوتيوب الأصلي
           والووترمارك تختفي — دي كانت المشكلة) */
        <ProtectedYouTubePlayer
          ytId={ytId}
          poster={poster}
          videoId={videoId}
          studentId={studentId}
          studentName={studentName}
          studentPhone={studentPhone}
          autoplay
        />
      ) : error ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black/70 text-white/80 text-xs p-4 text-center">
          <Lock className="h-7 w-7 text-white/50" />
          <span>{error}</span>
        </div>
      ) : (
        <div
          className="w-full h-full relative cursor-pointer group/vid"
          onClick={openPlayer}
          role="button"
          aria-label={'تشغيل ' + title}
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={title} className="w-full h-full object-cover" draggable={false} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-black/80 to-black" />
          )}
          <div className="absolute inset-0 bg-black/25 group-hover/vid:bg-black/40 transition-colors" />
          <div className="absolute inset-0 flex items-center justify-center">
            {loading ? (
              <Loader2 className="h-9 w-9 text-white animate-spin" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-2xl transition-transform group-hover/vid:scale-110">
                <svg className="h-8 w-8 text-white" style={{ marginLeft: '3px' }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ========== GATED VIDEO PLAYER — حماية الملفات المرفوعة ==========
 * بيجيب رابط التشغيل الموقّع من /api/video-play (توكن HMAC صالح ساعتين
 * مرتبط بالطالب والملف) — من غير توكن السيرفر مبيتخدمش الملف خالص.
 * ================================================================ */
function GatedVideoPlayer({ videoId, poster, studentId, studentName, studentPhone, onWatch }: {
  videoId: string
  poster?: string
  studentId: string
  studentName?: string
  studentPhone?: string
  onWatch: () => void
}) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')

  useEffect(function () {
    var alive = true
    setSrc(''); setError('')
    fetch('/api/video-play?videoId=' + videoId + '&studentId=' + encodeURIComponent(studentId || ''))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d } }) })
      .then(function (res) {
        if (!alive) return
        if (res.ok && res.d.isVideoFile && res.d.fileUrl) setSrc(res.d.fileUrl)
        else setError(res.d.error || 'الفيديو مش متاح')
      })
      .catch(function () { if (alive) setError('حصل خطأ في تحميل الفيديو') })
    return function () { alive = false }
  }, [videoId, studentId])

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black/70 text-white/80 text-xs p-4 text-center">
        <Lock className="h-7 w-7 text-white/50" />
        <span>{error}</span>
      </div>
    )
  }
  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/70">
        <Loader2 className="h-7 w-7 text-white/60 animate-spin" />
      </div>
    )
  }
  return (
    /* مشغّل ملفات محمي — الووترمارك جوه عنصر ملء الشاشة نفسه + ممنوع
       مشغّل أبل الأصلي (webkitEnterFullscreen) لأنه بيلغي أي طبقة فوق الفيديو */
    <ProtectedFilePlayer
      videoId={videoId}
      src={src}
      poster={poster}
      studentId={studentId}
      studentName={studentName}
      studentPhone={studentPhone}
      onWatch={onWatch}
    />
  )
}

/* ========== HOMEWORK TAB ========== */
/* ========== WRITING ANSWER BOX (نص + صورة) ========== */
function WritingAnswerBox({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  var fileRef = useRef<HTMLInputElement>(null)
  var [uploading, setUploading] = useState(false)

  var handlePickImage = async function(e: React.ChangeEvent<HTMLInputElement>) {
    var f = e.target.files && e.target.files[0]
    if (!f) return
    if (!f.type || f.type.indexOf('image/') !== 0) { toast.error('مسموح بالصور فقط'); return }
    if (f.size > 10 * 1024 * 1024) { toast.error('الصورة كبيرة جداً (الحد الأقصى 10MB)'); return }
    setUploading(true)
    try {
      var fd = new FormData()
      fd.append('file', f)
      fd.append('fileName', f.name)
      fd.append('category', 'homework-answer')
      var res = await fetch('/api/upload/chunk', { method: 'POST', body: fd })
      var data = await res.json()
      if (data.filePath) {
        onChange((value ? value + '\n' : '') + '[📷 صورة مرفقة: ' + data.filePath + ']')
        toast.success('تم إرفاق الصورة ✅ اكتب إجابتك كمان لو تحب')
      } else {
        toast.error(data.error || 'فشل رفع الصورة')
      }
    } catch (err) {
      toast.error('فشل رفع الصورة')
    }
    setUploading(false)
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={function(e) { onChange(e.target.value) }}
        disabled={disabled}
        rows={4}
        dir="auto"
        placeholder="اكتب إجابتك هنا..."
        className="w-full p-3 rounded-lg border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 min-h-[90px] whitespace-pre-wrap"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
        <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={function() { if (fileRef.current) fileRef.current.click() }}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 ml-1" />}
          ارفع صورة إجابتك
        </Button>
        <span className="text-[10px] text-muted-foreground">اكتب إجابتك أو صوّرها وارفعها — التصحيح الذكي هيفهمها</span>
      </div>
    </div>
  )
}

/* is this question a writing (مقالي) question? */
function isWritingQuestion(q: any): boolean {
  if (q.type === 'writing' || q.type === 'essay') return true
  if (Array.isArray(q.options) && q.options.length > 0) {
    return q.options.every(function(o: any) { return !o || o === 'N/A' || o === 'لا يوجد' || String(o).trim() === '' })
  }
  return !q.options || q.options.length === 0
}

function HomeworkTab({ homework, studentId }: { homework: Homework[]; studentId: string }) {
  var [expandedHw, setExpandedHw] = useState<string | null>(null)
  var [hwAnswers, setHwAnswers] = useState<Record<string, Record<number, number | string>>>({})
  var [hwSubmitting, setHwSubmitting] = useState<string | null>(null)
  var [submittedHwId, setSubmittedHwId] = useState<string | null>(null)
  var [blockedHwId, setBlockedHwId] = useState<string | null>(null)
  var [hwResults, setHwResults] = useState<Record<string, { score: number; maxScore: number }>>({})
  var [hwWrongQuestions, setHwWrongQuestions] = useState<Record<string, { question: string; studentAnswer: string; correctAnswer: string }[]>>({})
  var [hwAllQuestions, setHwAllQuestions] = useState<Record<string, any[]>>({})
  var [hwWritingAnswers, setHwWritingAnswers] = useState<Record<string, any[]>>({})
  var [shuffledHwQ, setShuffledHwQ] = useState<Record<string, any[]>>({})
  var hwPollTimers = useRef<Record<string, any>>({})

  /* Poll the background AI grading until it finishes — then update score + verdicts live */
  var startGradingPoll = function(resultId: string, hwId: string) {
    if (hwPollTimers.current[hwId]) clearInterval(hwPollTimers.current[hwId])
    var tries = 0
    hwPollTimers.current[hwId] = setInterval(async function() {
      tries++
      if (tries > 45) { clearInterval(hwPollTimers.current[hwId]); delete hwPollTimers.current[hwId]; return }
      try {
        var r = await fetch('/api/homework/result/' + resultId)
        var d = await r.json()
        if (d && d.ok && d.result && d.result.gradingDone) {
          clearInterval(hwPollTimers.current[hwId])
          delete hwPollTimers.current[hwId]
          setHwResults(function(prev) { return { ...prev, [hwId]: { score: d.result.score, maxScore: d.result.maxScore } } })
          if (d.result.writingAnswers && d.result.writingAnswers.length > 0) {
            setHwWritingAnswers(function(prev) { return { ...prev, [hwId]: d.result.writingAnswers } })
          }
          toast.success('خلص تصحيح الأسئلة المقالية بالذكاء الاصطناعي ✅')
        }
      } catch (e) {}
    }, 4000)
  }

  useEffect(function() {
    return function cleanup() {
      Object.keys(hwPollTimers.current).forEach(function(k) {
        clearInterval(hwPollTimers.current[k])
        delete hwPollTimers.current[k]
      })
    }
  }, [])

  // Load my past results: which homeworks are submitted + their scores
  useEffect(function() {
    if (!studentId) return
    fetch('/api/homework-results?studentId=' + studentId)
      .then(function(r) { return r.json() })
      .then(function(data) {
        var map: Record<string, { score: number; maxScore: number }> = {}
        ;(data.results || []).forEach(function(r: any) {
          map[r.homeworkId] = { score: r.score, maxScore: r.maxScore }
        })
        setHwResults(map)
      })
      .catch(function() {})
  }, [studentId])

  var handleExpandHw = function(hwId: string) {
    if (blockedHwId) { setBlockedHwId(null); return }
    if (submittedHwId) { setSubmittedHwId(null); setExpandedHw(null); return }
    if (expandedHw === hwId) { setExpandedHw(null); return }
    var hw = homework.find(function(h) { return h.id === hwId })
    if (!hw) return
    if (hwResults[hwId]) { setBlockedHwId(hwId); return }
    try {
      var qs = (hw as any).questions ? JSON.parse((hw as any).questions) : []
      if (Array.isArray(qs) && qs.length > 0) {
        var shuffled = shuffleQuestionsForStudent(qs, studentId, hwId)
        setShuffledHwQ(function(prev) { var a = { ...prev }; a[hwId] = shuffled; return a })
      }
    } catch { /* ignore */ }
    setExpandedHw(hwId)
  }

  var handleHwSubmit = async function(hwId: string) {
    var hw = homework.find(function(h) { return h.id === hwId })
    if (!hw) return
    var myAnswers = hwAnswers[hwId] || {}
    if (Object.keys(myAnswers).length === 0) return
    setHwSubmitting(hwId)
    try {
      // Map display answers back to ORIGINAL question indices
      var shQ = shuffledHwQ[hwId] || []
      var allQs: any[] = []
      try { allQs = JSON.parse((hw as any).questions) } catch (e) {}
      var mappedAnswers: Record<string, any> = {}
      var keys = Object.keys(myAnswers)
      for (var ki = 0; ki < keys.length; ki++) {
        var di = Number(keys[ki])
        var dq = shQ[di]
        if (!dq) continue
        var val = myAnswers[di]
        if (typeof val === 'number') {
          // MCQ: display option index → original option index
          mappedAnswers[String(dq._origIdx)] = dq._optMap ? dq._optMap[val] : val
        } else {
          // Writing: text (or text with attached image markers)
          mappedAnswers[String(dq._origIdx)] = val
        }
      }
      var res = await fetch('/api/homework/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId, homeworkId: hwId, answers: mappedAnswers }),
      })
      var data = await res.json()
      if (res.ok || data.alreadySubmitted) {
        if (data.pendingGrading && data.result && data.result.id) {
          toast.success('تم التسليم في ثانية ✅ التصحيح الذكي بيصحح الأسئلة المقالية دلوقتي والنتيجة هتظهر تلقائياً')
          startGradingPoll(data.result.id, hwId)
        } else {
          toast.success('تم تقديم الواجب بنجاح')
        }
        if (data.result) {
          setHwResults(function(prev) { return { ...prev, [hwId]: { score: data.result.score, maxScore: data.result.maxScore } } })
          if (data.result.wrongQuestions && data.result.wrongQuestions.length > 0) {
            setHwWrongQuestions(function(prev) { return { ...prev, [hwId]: data.result.wrongQuestions } })
          }
          setHwAllQuestions(function(prev) { return { ...prev, [hwId]: allQs } })
          if (data.result.writingAnswers && data.result.writingAnswers.length > 0) {
            setHwWritingAnswers(function(prev) { return { ...prev, [hwId]: data.result.writingAnswers } })
          }
        }
        setSubmittedHwId(hwId)
        setExpandedHw(null)
      } else {
        toast.error(data.error || 'حصل خطأ في التسليم')
      }
    } catch (e) {
      toast.error('خطأ في الاتصال')
    }
    setHwSubmitting(null)
  }

  // BLOCK SCREEN — homework already submitted: show score (+ wrong answers if in this session)
  if (blockedHwId) {
    var blockedHw = homework.find(function(h) { return h.id === blockedHwId })
    var bScore = hwResults[blockedHwId]
    var bWrong = hwWrongQuestions[blockedHwId] || []
    var bWriting = hwWritingAnswers[blockedHwId] || []
    var bPending = bWriting.some(function(wa) { return wa.gradingStatus === 'pending' })
    var bWritingBad = bWriting.some(function(wa) { return wa.isCorrect === false && wa.answer && String(wa.answer).trim() })
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-10 px-6 space-y-4">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold text-emerald-600">تم تقديم هذا الواجب بالفعل</h2>
            {blockedHw && <p className="text-sm text-muted-foreground">{blockedHw.title}</p>}
            {bScore && (
              <div className="space-y-1 mt-2">
                <p className="text-3xl font-bold text-primary">{bScore.score}/{bScore.maxScore}</p>
                <p className="text-sm text-muted-foreground">درجتك</p>
              </div>
            )}
          </div>
          <Button onClick={function() { setBlockedHwId(null) }} variant="outline">العودة إلى قائمة الواجبات</Button>
        </div>
        {bWrong.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-red-600">الإجابات الخاطئة ({bWrong.length}):</p>
            {bWrong.map(function(wq, wi) {
              return (
                <Card key={wi} className="border-red-200 dark:border-red-900/40">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-sm font-medium whitespace-pre-wrap break-words">{wi + 1}. {wq.question}</p>
                    <div className="space-y-1">
                      <p className="text-xs text-red-600">إجابتك: <span dir="auto">{wq.studentAnswer}</span></p>
                      <p className="text-xs text-emerald-600">الإجابة الصحيحة: <span dir="auto">{wq.correctAnswer}</span></p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
        {bWriting.some(function(wa) { return wa.aiExtractedAnswer }) && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-blue-600">🤖 قراءة التصحيح الذكي لإجاباتك:</p>
            {bWriting.filter(function(wa) { return wa.aiExtractedAnswer }).map(function(wa, wi) {
              return (
                <Card key={wi} className="border-blue-200 dark:border-blue-900/40">
                  <CardContent className="p-3 space-y-1">
                    <p className="text-xs font-medium whitespace-pre-wrap break-words">{wa.question}</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap break-words" dir="auto">{wa.aiExtractedAnswer}</p>
                    {wa.aiFeedback && <p className="text-[10px] text-muted-foreground">{wa.aiFeedback}</p>}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
        {bWrong.length === 0 && !bWritingBad && !bPending && bScore && bScore.score === bScore.maxScore && (
          <p className="text-sm text-emerald-600 font-medium text-center">أحسنت يا بطل! 🎉 جميع الإجابات صحيحة والدرجة النهائية كاملة</p>
        )}
        {bPending && (
          <p className="text-sm text-amber-600 font-medium flex items-center justify-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> لسه في أسئلة مقالية بتتصحح بالذكاء الاصطناعي — النتيجة النهائية هتتحدث تلقائياً</p>
        )}
      </div>
    )
  }

  // SUCCESS SCREEN — just submitted: score + all questions review
  if (submittedHwId) {
    var sHw = homework.find(function(h) { return h.id === submittedHwId })
    var sScore = hwResults[submittedHwId]
    var sWrong = hwWrongQuestions[submittedHwId] || []
    var sAllQs = hwAllQuestions[submittedHwId] || []
    var sWritingAnswers = hwWritingAnswers[submittedHwId] || []
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-10 px-6 space-y-3">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-emerald-600">تم تقديم الواجب بنجاح</h2>
          {sHw && <p className="text-sm text-muted-foreground">{sHw.title}</p>}
          {sScore && (
            <div className="space-y-1 text-center">
              <p className="text-3xl font-bold text-primary">{sScore.score}/{sScore.maxScore}</p>
              <p className="text-sm text-muted-foreground">درجتك</p>
            </div>
          )}
          <Button onClick={function() { setSubmittedHwId(null); setExpandedHw(null) }} variant="outline" className="mt-2">العودة إلى قائمة الواجبات</Button>
        </div>

        {sAllQs.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">مراجعة الأسئلة ({sAllQs.length}):</p>
            {sAllQs.map(function(q: any, qi: number) {
              var writing = isWritingQuestion(q)
              var qText = q.question || q.q || ''
              var writingAns = writing ? (sWritingAnswers.find(function(wa: any) { return wa.question === qText }) || sWritingAnswers[qi - (sAllQs.length - sWritingAnswers.length)] || null) : null
              var wIsCorrect = writingAns && writingAns.isCorrect === true
              var wIsWrong = !!(writingAns && writingAns.isCorrect === false && writingAns.answer && String(writingAns.answer).trim() && writingAns.gradingStatus !== 'manual')
              var wPending = writingAns && writingAns.gradingStatus === 'pending'
              if (writing) {
                return (
                  <Card key={qi} className={wIsWrong ? 'border-red-200 dark:border-red-900/40' : (wIsCorrect ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-amber-200 dark:border-amber-900/40')}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600 shrink-0 mt-0.5">مقالي</Badge>
                        <p className="font-medium text-sm flex-1 whitespace-pre-wrap break-words">{qi + 1}. {qText}</p>
                      </div>
                      {writingAns && (
                        <div className="space-y-1.5 text-sm">
                          {writingAns.answer && String(writingAns.answer).indexOf('[📷') < 0 && (
                            <p className="text-xs text-foreground whitespace-pre-wrap break-words" dir="auto">إجابتك: {writingAns.answer}</p>
                          )}
                          {writingAns.answer && String(writingAns.answer).indexOf('[📷 صورة مرفقة:') >= 0 && (function() {
                            var m = String(writingAns.answer).match(/\[📷\s*صورة\s*مرفقة:\s*([^\]]+?)\]/)
                            if (!m) return null
                            return (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">إجابتك (صورة):</p>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={m[1]} alt="إجابة الطالب" className="max-w-[200px] max-h-[150px] rounded-md border border-border/50 object-contain" onError={function(e) { var t = e.currentTarget as HTMLImageElement; if (t.parentElement) t.parentElement.style.display = 'none' }} />
                              </div>
                            )
                          })()}
                          {writingAns.gradingStatus === 'pending' && (
                            <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 flex items-center gap-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
                              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">جاري التصحيح بالذكاء الاصطناعي... النتيجة هتظهر هنا تلقائياً</p>
                            </div>
                          )}
                          {writingAns.aiExtractedAnswer && (
                            <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40">
                              <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 mb-1">🤖 الـ AI قري إجابتك:</p>
                              <p className="text-xs text-foreground whitespace-pre-wrap break-words" dir="auto">{writingAns.aiExtractedAnswer}</p>
                              {writingAns.aiFeedback && <p className="text-[10px] text-muted-foreground mt-1">{writingAns.aiFeedback}</p>}
                            </div>
                          )}
                          {writingAns.modelAnswer && (
                            <p className="text-xs text-emerald-600 whitespace-pre-wrap break-words" dir="auto">الإجابة النموذجية: {writingAns.modelAnswer}</p>
                          )}
                          {writingAns.awardedPoints !== undefined && (
                            <p className="text-[10px] font-semibold text-muted-foreground">الدرجة: {writingAns.awardedPoints}/{writingAns.maxPoints || writingAns.points}</p>
                          )}
                        </div>
                      )}
                      {!writingAns && (
                        <p className="text-xs text-muted-foreground">إجابتك: (فارغة — ما الإجبتش)</p>
                      )}
                    </CardContent>
                  </Card>
                )
              }
              var opts = Array.isArray(q.options) ? q.options : []
              var correctIdx = typeof q.correct === 'number' ? q.correct : 0
              var wrongEntry = sWrong.find(function(w) { return w.question === qText })
              return (
                <Card key={qi} className={wrongEntry ? 'border-red-200 dark:border-red-900/40' : 'border-emerald-200 dark:border-emerald-900/40'}>
                  <CardContent className="p-3 space-y-2">
                    <p className="font-medium text-sm whitespace-pre-wrap break-words">{qi + 1}. {qText}</p>
                    <div className="space-y-1 text-xs">
                      {wrongEntry ? (
                        <>
                          <p className="text-red-600">إجابتك: <span dir="auto">{wrongEntry.studentAnswer}</span></p>
                          <p className="text-emerald-600">الإجابة الصحيحة: <span dir="auto">{wrongEntry.correctAnswer}</span></p>
                        </>
                      ) : (
                        <p className="text-emerald-600">إجابتك صحيحة ✅</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
        {sAllQs.length === 0 && sWrong.length === 0 && sScore && sScore.score === sScore.maxScore && (
          <p className="text-sm text-emerald-600 font-medium text-center">أحسنت يا بطل! 🎉 جميع الإجابات صحيحة</p>
        )}
        {sWritingAnswers.some(function(wa) { return wa.gradingStatus === 'pending' }) && (
          <p className="text-sm text-amber-600 font-medium flex items-center justify-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> لسه في أسئلة مقالية بتتصحح بالذكاء الاصطناعي — النتيجة النهائية هتتحدث تلقائياً</p>
        )}
      </div>
    )
  }

  if (homework.length === 0) return <EmptyState message="لا توجد واجبات حالياً" />
  return (
    <div className="space-y-3">
      {homework.map(function(hw) {
        var allQs: any[] = []
        try { if ((hw as any).questions) { var parsed = JSON.parse((hw as any).questions); if (Array.isArray(parsed)) allQs = parsed } } catch {}
        var hasQuestions = allQs.length > 0
        var mcqCount = allQs.filter(function(q) { return !isWritingQuestion(q) }).length
        var writingCount = allQs.length - mcqCount
        var isSubmitted = !!hwResults[hw.id]
        var isExpanded = expandedHw === hw.id && !isSubmitted
        var myAnswers = hwAnswers[hw.id] || {}
        var shQ = shuffledHwQ[hw.id] || []

        return (
          <Card key={hw.id} className={isSubmitted ? 'border-emerald-500/30' : (hasQuestions ? 'cursor-pointer' : '')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3" onClick={hasQuestions ? function() { handleExpandHw(hw.id) } : undefined}>
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={"h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 " + (hasQuestions ? 'bg-emerald-500/10' : 'bg-blue-500/10')}>
                    <ClipboardList className={"h-4 w-4 " + (hasQuestions ? 'text-emerald-500' : 'text-blue-500')} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-semibold text-sm">{hw.title}</h3>
                    {hw.content && <p className="text-xs text-muted-foreground line-clamp-2">{hw.content}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[10px] text-muted-foreground">{new Date(hw.createdAt).toLocaleDateString('ar-EG')}</p>
                      {isSubmitted ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">تم تقديم هذا الواجب</Badge>
                      ) : null}
                      {hasQuestions && !isSubmitted && mcqCount > 0 && <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-600">{mcqCount} اختياري</Badge>}
                      {hasQuestions && !isSubmitted && writingCount > 0 && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">{writingCount} مقالي</Badge>}
                      {isSubmitted && hwResults[hw.id] && <Badge className="text-[10px] bg-emerald-500 text-white">النتيجة: {hwResults[hw.id].score}/{hwResults[hw.id].maxScore}</Badge>}
                    </div>
                  </div>
                </div>
                {hw.filePath && !hasQuestions && <FileAttachment filePath={hw.filePath} fileType={hw.fileType} />}
                {hasQuestions && <ChevronLeft className={"h-4 w-4 text-muted-foreground transition-transform shrink-0 mt-1 " + (isExpanded ? 'rotate-90' : '')} />}
              </div>

              {isExpanded && hasQuestions && shQ.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-4" onClick={function(e) { e.stopPropagation() }}>
                  {shQ.map(function(q: any, qi: number) {
                    var writing = isWritingQuestion(q)
                    var pts = (typeof q.points === 'number' && q.points > 0) ? q.points : (writing ? 5 : 1)
                    if (writing) {
                      return (
                        <div key={qi} className="space-y-2 rounded-lg p-2 border border-amber-500/20 bg-amber-50 dark:bg-amber-900/10">
                          <p className="font-medium text-sm whitespace-pre-wrap break-words">
                            {qi + 1}. {q.question}
                            <span className="text-muted-foreground text-xs ml-2">({pts} درجات)</span>
                            <Badge variant="outline" className="text-[9px] ml-2 border-amber-500/40 text-amber-600">مقالي</Badge>
                          </p>
                          <WritingAnswerBox
                            value={typeof myAnswers[qi] === 'string' ? (myAnswers[qi] as string) : ''}
                            onChange={function(val: string) {
                              setHwAnswers(function(prev) {
                                var a = { ...prev }
                                a[hw.id] = { ...(a[hw.id] || {}), [qi]: val }
                                return a
                              })
                            }}
                            disabled={hwSubmitting === hw.id}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={qi} className="space-y-2 rounded-lg p-2">
                        <p className="font-medium text-sm flex-1 whitespace-pre-wrap break-words">{qi + 1}. {q.question} <span className="text-muted-foreground text-xs">({pts} درجات)</span></p>
                        <div className="space-y-1.5">
                          {q.options.map(function(opt: string, oi: number) {
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
  var [answers, setAnswers] = useState<Record<number, number | string>>({})
  var [submitting, setSubmitting] = useState(false)
  var [examQuestions, setExamQuestions] = useState<any[]>([])
  var [submittedMsg, setSubmittedMsg] = useState<string | null>(null)
  var [submittedExamIds, setSubmittedExamIds] = useState<Set<string>>(new Set())
  var [lockedOut, setLockedOut] = useState(false)
  // نتيجة آخر تسليم (الدرجة + تصحيح المقالية بالذكاء الاصطناعي)
  var [lastResult, setLastResult] = useState<any>(null)
  var [showGradesFor, setShowGradesFor] = useState<string | null>(null)

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

  // Post-submission: success screen with the AI-graded score + writing feedback
  if (submittedMsg) {
    var lrGrades: any[] = (lastResult && lastResult.writingGrades) || []
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 space-y-5">
        <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">تم تقديم الامتحان</h2>
          {lastResult && typeof lastResult.score === 'number' ? (
            <div className="mt-2 inline-flex flex-col items-center gap-1.5">
              <div className="px-6 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-3xl font-bold text-emerald-600" dir="ltr">{lastResult.score} / {lastResult.maxScore}</p>
                <p className="text-[10px] text-muted-foreground mt-1">درجتك في الامتحان</p>
              </div>
              {lrGrades.length > 0 && <p className="text-xs text-emerald-600 font-medium">✅ الأسئلة المقالية اتصححت بالذكاء الاصطناعي</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">النتيجة هتظهر في قائمة الامتحانات خلال شوية</p>
          )}
        </div>
        {lrGrades.length > 0 && (
          <div className="w-full max-w-xl space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">تفاصيل تصحيح الأسئلة المقالية:</p>
            {lrGrades.map(function(g: any, i: number) {
              var gOk = g.isCorrect === true
              var gHalf = !gOk && (Number(g.awardedPoints) || 0) > 0
              return (
                <Card key={'wg-' + i} className={gOk ? 'border-emerald-200 dark:border-emerald-900/40' : gHalf ? 'border-amber-200 dark:border-amber-900/40' : 'border-red-200 dark:border-red-900/40'}>
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium min-w-0">{g.question || ''}</p>
                      <Badge className={'text-[10px] shrink-0 ' + (gOk ? 'bg-emerald-500 text-white' : gHalf ? 'bg-amber-500 text-white' : 'bg-red-500 text-white')} dir="ltr">{g.awardedPoints}/{g.maxPoints}</Badge>
                    </div>
                    {g.feedback && <p className="text-[10px] text-muted-foreground">🤖 {g.feedback}</p>}
                    {g.modelAnswer && (
                      <p className="text-[10px] text-emerald-600">الإجابة النموذجية: {g.modelAnswer}</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
        <Button variant="outline" className="mt-2 gap-2" onClick={function() { setSubmittedMsg(null); setTakingExam(null); setAnswers({}); setExamQuestions([]); setLockedOut(false) }}>
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
          var isWriting = isWritingQuestion(q)
          return (
            <Card key={qi}>
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-sm whitespace-pre-wrap break-words">
                  {qi + 1}. {q.question}
                  {isWriting && <Badge variant="outline" className="text-[9px] mr-2 border-amber-500/40 text-amber-600">مقالي</Badge>}
                </p>
                {isWriting ? (
                  <WritingAnswerBox
                    value={typeof answers[qi] === 'string' ? (answers[qi] as string) : ''}
                    onChange={function(val: string) { setAnswers(function(prev) { var a = { ...prev }; a[qi] = val; return a }) }}
                    disabled={submitting}
                  />
                ) : (
                  <div className="space-y-2">
                    {q.options.map(function(opt: string, oi: number) {
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
                )}
              </CardContent>
            </Card>
          )
        })}
        <Button
          className="w-full"
          disabled={!examQuestions.every(function(q, qi) { return isWritingQuestion(q) || answers[qi] !== undefined }) || submitting}
          onClick={function() {
            setSubmitting(true)
            var serverAnswers: Record<string, any> = {}
            var keys = Object.keys(answers)
            for (var ki = 0; ki < keys.length; ki++) {
              var di = Number(keys[ki])
              var eq = examQuestions[di]
              var val = answers[di]
              if (typeof val === 'number') {
                serverAnswers[String(eq._origIdx)] = eq._optMap ? eq._optMap[val] : val
              } else {
                serverAnswers[String(eq._origIdx)] = val
              }
            }
            // Add client-side timeout (120s — AI grades the writing questions during submit)
            var submitController = new AbortController()
            var submitTimeout = setTimeout(function() { submitController.abort() }, 120000)
            fetch('/api/exams/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ studentId: studentId, examId: takingExam, answers: serverAnswers }),
              signal: submitController.signal,
            })
            .then(function(r) { return r.json() })
            .then(function(data) {
              clearTimeout(submitTimeout)
              // الدرجة وتصحيح المقالية رجعوا من السيرفر (تصحيح فوري بالذكاء الاصطناعي)
              if (data && typeof data.score === 'number') {
                setLastResult({ examId: takingExam, score: data.score, maxScore: data.maxScore, writingGrades: data.writingGrades || [] })
              }
              setSubmittedExamIds(function(prev) { var s = new Set(prev); s.add(takingExam); return s })
              setSubmittedMsg('تم تقديم هذا الامتحان')
            })
            .catch(function() {
              clearTimeout(submitTimeout)
              setSubmittedExamIds(function(prev) { var s = new Set(prev); s.add(takingExam); return s })
              setSubmittedMsg('تم تقديم هذا الامتحان')
            })
            .finally(function() { setSubmitting(false) })
          }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تقديم الامتحان'}
        </Button>
      </div>
    )
  }

  // Exam List Mode
  return (
    <div className="space-y-3">
      {exams.map(function(exam) {
        var examResult: any = results.find(function(r) { return r.examId === exam.id })
        var isSubmitted = !!(examResult || submittedExamIds.has(exam.id))
        // نتيجة لحظية من آخر تسليم (لو لسه متحدثش في اللستة)
        var liveResult = (lastResult && lastResult.examId === exam.id) ? lastResult : examResult
        var liveGrades: any[] = (liveResult && liveResult.writingGrades) || []
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          تم تقديم هذا الامتحان
                        </Badge>
                        {liveResult && typeof liveResult.score === 'number' && (
                          <Badge className="text-xs bg-primary text-primary-foreground" dir="ltr">{liveResult.score}/{liveResult.maxScore}</Badge>
                        )}
                        {liveGrades.length > 0 && (
                          <button type="button" onClick={function() { setShowGradesFor(showGradesFor === exam.id ? null : exam.id) }} className="text-[11px] font-medium text-primary hover:underline cursor-pointer">
                            {showGradesFor === exam.id ? 'اقفل التصحيح' : 'شوف تصحيح المقالية 👁'}
                          </button>
                        )}
                      </div>
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
              {/* تفاصيل تصحيح المقالية بالذكاء الاصطناعي */}
              {isSubmitted && showGradesFor === exam.id && liveGrades.length > 0 && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  {liveGrades.map(function(g: any, gi: number) {
                    var gOk = g.isCorrect === true
                    var gHalf = !gOk && (Number(g.awardedPoints) || 0) > 0
                    return (
                      <div key={'g-' + gi} className={'p-2.5 rounded-lg border space-y-1 ' + (gOk ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-900/10' : gHalf ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10' : 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10')}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium min-w-0">{g.question || ''}</p>
                          <Badge className={'text-[10px] shrink-0 ' + (gOk ? 'bg-emerald-500 text-white' : gHalf ? 'bg-amber-500 text-white' : 'bg-red-500 text-white')} dir="ltr">{g.awardedPoints}/{g.maxPoints}</Badge>
                        </div>
                        {g.answer && (
                          <p className="text-[10px] text-muted-foreground">إجابتك: {g.answer}</p>
                        )}
                        {g.modelAnswer && (
                          <p className="text-[10px] text-emerald-600">الإجابة النموذجية: {g.modelAnswer}</p>
                        )}
                        {g.feedback && <p className="text-[10px] text-muted-foreground">🤖 {g.feedback}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
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
