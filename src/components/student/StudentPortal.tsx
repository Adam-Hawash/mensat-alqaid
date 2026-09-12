'use client'

import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Video, ClipboardList, FileText, Megaphone, MessageSquare, Send,
  LogOut, Loader2, FileDown, Bell, PlayCircle, CheckCircle2, Timer, XCircle,
  BookOpen, Target, TrendingUp, GraduationCap, ChevronLeft,
  User, Phone, Award, Lock, X, ImagePlus, ListTodo, Flag, Search, ExternalLink, Clock,
} from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { SecurePlayerModal } from '@/components/student/SecurePlayerModal'
import { StudentComplaints } from '@/components/student/StudentComplaints'
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

/* ===== (2026-و25 نقل 25-b2) مساعدات العداد التنازلي والجدولة ===== */
function formatExamClock(ms: number): string {
  var total = Math.max(0, Math.ceil(ms / 1000))
  var mm = Math.floor(total / 60)
  var ss = total % 60
  return (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss
}

/* أي امتحان/واجب scheduledAt مستقبلي بيتجاهل بصمت من قوائم الطالب
   (حماية من بيانات قديمة — وقيمة التاريخ البايظة مبتخفيش العنصر) */
function isExamScheduledAhead(scheduledAt: any): boolean {
  try {
    if (!scheduledAt) return false
    var t = new Date(scheduledAt).getTime()
    if (isNaN(t)) return false
    return t > Date.now()
  } catch { return false }
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
  /* الواجبات اللي الطالب سلّمها — عشان قايمة "اللي ناقصك" ميعرضهالوش تاني (طلب المستر) */
  const [completedHwIds, setCompletedHwIds] = useState<Set<string>>(new Set())

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
          timeout('/api/homework?grade=' + g + '&pageSize=50&studentId=' + encodeURIComponent(studentId), 15000),
          timeout('/api/exams?grade=' + g + '&pageSize=50&studentId=' + encodeURIComponent(studentId), 15000),
          timeout('/api/announcements?grade=' + g + '&pageSize=10', 15000),
          timeout('/api/exam-results?studentId=' + encodeURIComponent(studentId), 15000),
          timeout('/api/activities?studentId=' + studentId + '&action=watched_video&pageSize=200', 15000),
          fetch('/api/homework-results?studentId=' + encodeURIComponent(studentId)).then(function(r) { return r.json() }).catch(function() { return { results: [] } }),
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
        /* الواجبات المسلّمة → تختفي من قايمة المطلوب فورًا */
        var doneHw: string[] = []
        ;((results[6] && results[6].results) || []).forEach(function(r: any) {
          if (r && r.homeworkId) doneHw.push(r.homeworkId)
        })
        if (doneHw.length > 0) {
          setCompletedHwIds(function(prev) { var n = new Set(prev); doneHw.forEach(function(id) { n.add(id) }); return n })
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false)
    })()
    return function() { cancelled = true }
  }, [grade, studentId])

  const stats = useMemo(() => {
    if (!dashboardData) return { completedLessons: 0, pendingHomework: 0, lastScore: null, progress: 0, lastVideo: null, upcomingTasks: [] as any[] }
    const { videos, homework, exams, examResults, watchedIds, announcements } = dashboardData
    const completedLessons = watchedIds.size
    /* المطلوب دلوقتي = اللي **ماعملهوش** بس — اللي خلص واجب أو امتحان مش بيتكرر له (طلب المستر) */
    const pendingHwList = homework.filter(function(h) { return !completedHwIds.has(h.id) })
    const pendingExamList = exams.filter(function(e) {
      /* (2026-و25 نقل 25-b2) الامتحان المجدول في المستقبل بيتجاهل بصمت من القوائم */
      return !examResults.find(function(r) { return r.examId === e.id }) && !isExamScheduledAhead((e as any).scheduledAt)
    })
    const pendingHomework = pendingHwList.length
    const lastScore = examResults.length > 0 ? examResults[0] : null
    const progress = videos.length > 0 ? Math.round((watchedIds.size / videos.length) * 100) : 0
    const lastVideo = videos.find(v => !watchedIds.has(v.id)) || videos[0] || null
    const upcomingTasks: any[] = []
    pendingHwList.slice(0, 2).forEach(hw => upcomingTasks.push({ type: 'homework', title: hw.title, icon: ClipboardList, color: 'text-blue-500' }))
    pendingExamList.slice(0, 2).forEach(ex => upcomingTasks.push({ type: 'exam', title: ex.title, icon: FileText, color: 'text-orange-500' }))
    if (lastVideo && !watchedIds.has(lastVideo.id)) upcomingTasks.push({ type: 'lesson', title: lastVideo.title, icon: Video, color: 'text-purple-500' })
    if (announcements.length > 0) upcomingTasks.push({ type: 'important', title: announcements[0].title, icon: Bell, color: 'text-red-500' })
    return { completedLessons, pendingHomework, lastScore, progress, lastVideo, upcomingTasks: upcomingTasks.slice(0, 4) }
  }, [dashboardData, completedHwIds])

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
            { key: 'complaints', icon: Flag, label: 'الشكاوي' },
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
        {activeTab === 'complaints' && <StudentComplaints studentId={studentId} studentName={currentStudent?.name || ''} studentPhone={currentStudent?.phone || ''} grade={grade} />}
      </div>
    </div>
  )
}

/* ========== VIDEOS TAB ========== */

// أدوات نوع الفيديو — على مستوى الملف عشان نقدر نستخدمها في الـ memo بشكل آمن
function ytIdOf(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([\w-]{11})/)
  return match ? match[1] : null
}

function videoKindOf(v: any): 'youtube' | 'file' | 'link' | 'none' {
  if (v.kind) return v.kind
  if (ytIdOf(v.url || '')) return 'youtube'
  if (v.filePath && /\.(mp4|webm|mov|avi)$/i.test(v.filePath)) return 'file'
  if (v.url) return 'link'
  return 'none'
}

function VideosTab({ videos, watchedIds, studentId, grade }: { videos: VideoType[]; watchedIds: Set<string>; studentId: string; grade: string }) {
  const { setView, setPendingPaymentVideo } = useAppStore()
  const currentStudent = useAppStore(function (s) { return s.currentStudent })
  const studentName = currentStudent?.name || ''
  const studentPhone = currentStudent?.phone || ''
  const [localWatched, setLocalWatched] = useState(watchedIds)
  // (2026-ف — رجعة نظام الجدولة القديم زي ما كان بالظبط)
  const [videoSchedules, setVideoSchedules] = useState<Record<string, any>>({})
  const [hiddenVideoIds, setHiddenVideoIds] = useState<Set<string>>(new Set())
  const [activeLessonVideo, setActiveLessonVideo] = useState<VideoType | null>(null)

  // Load video schedules for this student
  useEffect(() => {
    if (!studentId) return
    fetch('/api/video-schedule?studentId=' + studentId)
      .then(function(r) { return r.json() })
      .then(function(data) {
        var map: Record<string, any> = {}
        ;(data.schedules || []).forEach(function(s: any) {
          map[s.videoId] = s
        })
        setVideoSchedules(map)
        setHiddenVideoIds(new Set(data.hiddenVideoIds || []))
      })
      .catch(function() {})
  }, [studentId])

  // Check if video is locked for this student (scheduled but not yet unlocked)
  const isVideoLocked = (videoId: string): { locked: boolean; unlockAt?: Date; schedule?: any } => {
    var sched = videoSchedules[videoId]
    if (!sched || !sched.unlockAt) return { locked: false }
    var unlockDate = new Date(sched.unlockAt)
    if (unlockDate.getTime() > Date.now()) {
      return { locked: true, unlockAt: unlockDate, schedule: sched }
    }
    return { locked: false }
  }

  // نسب المشاهدة من السيرفر — بنجيبها مرة واحدة عند فتح التاب عشان أقفال
  // التسلسل تبقى صحيحة من أول لحظة (قبل ما الداتا توصل مفيش حاجة تتقفل)
  const [baseProgress, setBaseProgress] = useState<Record<string, number>>({})
  const [progressLoaded, setProgressLoaded] = useState(false)
  useEffect(function () {
    if (!studentId) { setProgressLoaded(true); return }
    var dead = false
    fetch('/api/video-progress?studentId=' + encodeURIComponent(studentId))
      .then(function (r) { return r.json() })
      .then(function (d) {
        if (dead) return
        var map: Record<string, number> = {}
        ;((d.progress || []) as any[]).forEach(function (row) {
          if (row && row.videoId && row.totalSeconds > 0) {
            map[row.videoId] = Math.min(100, Math.round((row.watchedSeconds / row.totalSeconds) * 100))
          }
        })
        setBaseProgress(map)
        setProgressLoaded(true)
      })
      .catch(function () { if (!dead) setProgressLoaded(true) })
    return function () { dead = true }
  }, [studentId])

  // نسب المشاهدة المحلية — بتتحدث أول ما المشغل يقفل عشان الأقفال تتحدث لحظيًا
  const [progressOverrides, setProgressOverrides] = useState<Record<string, number>>({})
  const mergedProgress = useMemo(function () {
    return Object.assign({}, baseProgress, progressOverrides)
  }, [baseProgress, progressOverrides])

  // ترتيب الدروس من الأقدم للأحدث — ده ترتيب نزول الدروس نفسه (الأول في المنهج فوق)
  const orderedVideos = useMemo(function () {
    return videos.slice().sort(function (a, b) {
      var ta = new Date((a as any).createdAt || 0).getTime()
      var tb = new Date((b as any).createdAt || 0).getTime()
      return ta - tb
    })
  }, [videos])

  // قفل التسلسل (طلب المستر): الفيديو ميفتحش غير لما اللي قبله يتشاف كامل 100%
  const lockedMap = useMemo(function () {
    var map: Record<string, boolean> = {}
    var prevTrackable: string | null = null
    orderedVideos.forEach(function (v) {
      var k = videoKindOf(v)
      var trackable = k === 'youtube' || k === 'file'
      if (progressLoaded && trackable && prevTrackable) {
        var pct = mergedProgress[prevTrackable] || 0
        map[v.id] = pct < 99
      } else {
        map[v.id] = false
      }
      if (trackable) prevTrackable = v.id
    })
    return map
  }, [orderedVideos, mergedProgress, progressLoaded])

  // الفيديو اللي قبل كل فيديو (عشان نعرض نسبته على كارت المقفول)
  const prevVideoMap = useMemo(function () {
    var map: Record<string, string> = {}
    var prevTrackable: string | null = null
    orderedVideos.forEach(function (v) {
      var k = videoKindOf(v)
      var trackable = k === 'youtube' || k === 'file'
      if (trackable && prevTrackable) map[v.id] = prevTrackable
      if (trackable) prevTrackable = v.id
    })
    return map
  }, [orderedVideos])

  // فتح أي درس (يوتيوب أو ملف مرفوع): بنطلب تذكرة تشغيل واحدة الاستخدام
  // من /api/video-ticket — مفيش أي YouTube ID أو رابط ملف بيرجع للصفحة.
  const openPlayModal = (video: VideoType) => {
    // قفل التسلسل: اللي قبله لسه متشافش كامل → منع + رسالة (طلب المستر)
    if (lockedMap[video.id]) {
      toast.error('الفيديو ده هيتفتح أول ما تشوف الفيديو اللي قبله كامل (100%) — كمّل مشاهدة الفيديو اللي قبله الأول', { duration: 6000 })
      return
    }
    fetch('/api/video-ticket?videoId=' + video.id + '&studentId=' + encodeURIComponent(studentId || ''))
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, d: d } })
      })
      .then(function (res) {
        if (res.ok && res.d.ok && res.d.ticket) {
          setActiveLessonVideo({ ...video, playTicket: res.d.ticket } as any)
        } else {
          toast.error(res.d.error || 'الفيديو مش متاح — لو دفعت تواصل مع الإدارة', { duration: 6000 })
        }
      })
      .catch(function () { toast.error('حصل خطأ في تشغيل الفيديو') })
  }

  const trackVideoWatch = (videoId: string) => {
    if (!studentId || localWatched.has(videoId)) return
    setLocalWatched(prev => new Set([...prev, videoId]))
    fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, action: 'watched_video', details: `Watched: ${videoId}` }),
    }).catch(() => {})
  }

  if (videos.length === 0) return <EmptyState message="لا توجد دروس حالياً" />

  return (
    <>
    <div className="grid gap-4 md:grid-cols-2">
      {orderedVideos.map((video) => {
        // Skip hidden videos entirely (الجدولة القديمة — الإخفاء)
        if (hiddenVideoIds.has(video.id)) return null
        const kind = videoKindOf(video)
        const isWatched = localWatched.has(video.id)
        const thumbSrc = video.thumbnail || (video as any).thumb || null
        const needsPay = (video.price || 0) > 0
        // مقفول بالتسلسل؟ الفيديو اللي قبله لسه نسبته أقل من 99%
        const isSeqLocked = lockedMap[video.id] === true
        const prevVideoId = prevVideoMap[video.id]
        const prevPct = prevVideoId ? (mergedProgress[prevVideoId] || 0) : 0
        const scheduleInfo = isVideoLocked(video.id)

        // If video is scheduled and locked, show countdown instead (الجدولة القديمة)
        if (scheduleInfo.locked && scheduleInfo.unlockAt) {
          return (
            <Card key={video.id} className="overflow-hidden border-amber-500/30">
              <div className="relative aspect-video bg-gradient-to-br from-amber-900/50 to-black flex flex-col items-center justify-center gap-3 p-4">
                <div className="h-14 w-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Lock className="h-7 w-7 text-amber-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-sm mb-1">الفيديو هيفتح بعد ما تحضر الحصة بتاعتك</p>
                  <CountdownTimer unlockAt={scheduleInfo.unlockAt} />
                </div>
              </div>
              <CardContent className="p-3">
                <h3 className="font-semibold text-sm">{video.title}</h3>
              </CardContent>
            </Card>
          )
        }

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
              ) : isSeqLocked ? (
                // مقفول بالتسلسل — قفل + رسالة (طلب المستر: هيتفتح أول ما تشوف اللي قبله كامل)
                <div
                  className="w-full h-full relative cursor-not-allowed select-none"
                  onClick={function () { toast.error('الفيديو ده هيتفتح أول ما تشوف الفيديو اللي قبله كامل (100%) — كمّل مشاهدة الفيديو اللي قبله الأول', { duration: 6000 }) }}
                  role="button"
                  aria-label="الفيديو مقفول — هيتفتح أول ما تشوف الفيديو اللي قبله كامل"
                >
                  {thumbSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbSrc} alt={video.title} className="w-full h-full object-cover opacity-25 grayscale" draggable={false} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-black/80 to-black" />
                  )}
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-20 px-4 text-center">
                    <div className="h-12 w-12 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center shrink-0">
                      <Lock className="h-6 w-6 text-red-400" />
                    </div>
                    <p className="text-white text-xs sm:text-sm font-bold leading-relaxed">
                      الفيديو ده هيتفتح أول ما تشوف الفيديو اللي قبله كامل
                    </p>
                    {prevPct > 0 && (
                      <p className="text-white/60 text-[10px]">نسبة الفيديو اللي قبله دلوقتي: {prevPct}%</p>
                    )}
                  </div>
                </div>
              ) : kind === 'youtube' || kind === 'file' ? (
                /* كارت الدرس المحمي — صورة مصغرة بس. الفيديو بيتفتح في المشغل
                   الآمن عن طريق تذكرة واحدة الاستخدام من /api/video-ticket */
                <div
                  className="w-full h-full relative cursor-pointer group/vid"
                  onClick={function () { openPlayModal(video) }}
                  role="button"
                  aria-label={'تشغيل ' + video.title}
                >
                  {thumbSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbSrc} alt={video.title} className="w-full h-full object-cover transition-transform duration-500 group-hover/vid:scale-105" draggable={false} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-black/80 to-black" />
                  )}
                  <div className="absolute inset-0 bg-black/25 group-hover/vid:bg-black/40 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-2xl transition-transform group-hover/vid:scale-110">
                      <PlayCircle className="h-8 w-8 text-primary ml-0.5" />
                    </div>
                  </div>
                </div>
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
    {/* المشغل الآمن — تذكرة واحدة الاستخدام، مفيش أي لينك في الصفحة */}
    {activeLessonVideo && (activeLessonVideo as any).playTicket && (
      <SecurePlayerModal
        ticket={(activeLessonVideo as any).playTicket}
        title={activeLessonVideo.title}
        poster={activeLessonVideo.thumbnail || (activeLessonVideo as any).thumb || undefined}
        videoId={activeLessonVideo.id}
        studentId={studentId}
        onWatch={function () {
          trackVideoWatch(activeLessonVideo.id)
          setLocalWatched(function (prev) { return new Set([...prev, activeLessonVideo.id]) })
        }}
        onClose={function () {
          var vid = activeLessonVideo.id
          setActiveLessonVideo(null)
          // نجيب نسبة المشاهدة الأخيرة للفيديو — عشان قفل الفيديو اللي بعده يتحدّث فورًا
          if (!studentId) return
          fetch('/api/video-progress?studentId=' + studentId + '&videoId=' + vid)
            .then(function (r) { return r.json() })
            .then(function (d) {
              var rows = (d.progress || []) as any[]
              var row = rows.find(function (x) { return x && x.videoId === vid }) || rows[0]
              if (row && row.totalSeconds > 0) {
                var pct = Math.min(100, Math.round((row.watchedSeconds / row.totalSeconds) * 100))
                setProgressOverrides(function (prev) {
                  var n = Object.assign({}, prev)
                  n[vid] = pct
                  return n
                })
              }
            })
            .catch(function () {})
        }}
      />
    )}
    </>
  )
}

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
  var [hwResults, setHwResults] = useState<Record<string, { score: number; maxScore: number; resultId?: string }>>({})
  var [hwWrongQuestions, setHwWrongQuestions] = useState<Record<string, { question: string; studentAnswer: string; correctAnswer: string }[]>>({})
  var [hwAllQuestions, setHwAllQuestions] = useState<Record<string, any[]>>({})
  var [hwWritingAnswers, setHwWritingAnswers] = useState<Record<string, any[]>>({})
  var [shuffledHwQ, setShuffledHwQ] = useState<Record<string, any[]>>({})
  var hwPollTimers = useRef<Record<string, any>>({})
  /* (2026-و25 نقل 25-a) مراجعة الواجب المسلّم: resultId في hwResults + جلب ملاحظات
     المصحح من /api/homework/result/[id] مرة واحدة عند الفتح + تحديث تلقائي واحد
     بعد 12 ثانية لو المقالي لسه بيتصحح + زرار تحديث يدوي */
  var hwReviewAutoRefreshed = useRef<Record<string, boolean>>({})
  var hwReviewTimers = useRef<Record<string, any>>({})

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
      Object.keys(hwReviewTimers.current).forEach(function(k) {
        clearTimeout(hwReviewTimers.current[k])
        delete hwReviewTimers.current[k]
      })
    }
  }, [])

  // Load my past results: which homeworks are submitted + their scores (+ resultId for review)
  useEffect(function() {
    if (!studentId) return
    fetch('/api/homework-results?studentId=' + studentId)
      .then(function(r) { return r.json() })
      .then(function(data) {
        var map: Record<string, { score: number; maxScore: number; resultId?: string }> = {}
        ;(data.results || []).forEach(function(r: any) {
          map[r.homeworkId] = { score: r.score, maxScore: r.maxScore, resultId: r.id }
        })
        setHwResults(map)
      })
      .catch(function() {})
  }, [studentId])

  /* (2026-و25 نقل 25-a) refreshHwReview — جلب تصحيح المقالي من /api/homework/result/[id]
     (النقطة الموجودة للـ poll نفسه) وتحديث الدرجة + الملاحظات — بمحلل متسامح */
  var refreshHwReview = async function(hwId: string) {
    var entry = hwResults[hwId]
    var rid = entry && entry.resultId
    if (!rid) return
    try {
      var r = await fetch('/api/homework/result/' + rid)
      var d = await r.json()
      if (d && d.ok && d.result) {
        if (d.result.writingAnswers && d.result.writingAnswers.length > 0) {
          setHwWritingAnswers(function(prev) { return { ...prev, [hwId]: d.result.writingAnswers } })
        }
        if (typeof d.result.score === 'number') {
          setHwResults(function(prev) {
            var old = prev[hwId] || { score: 0, maxScore: 0 }
            return { ...prev, [hwId]: { ...old, score: d.result.score, maxScore: d.result.maxScore || old.maxScore } }
          })
        }
      }
    } catch (e) {}
  }

  /* openHwReview — مرة واحدة عند فتح شاشة «تم تقديم بالفعل»:
     جلب فوري + تحديث تلقائي واحد بعد 12 ثانية لو المقالي لسه pending */
  var openHwReview = function(hwId: string) {
    refreshHwReview(hwId)
    var loaded = hwWritingAnswers[hwId] || []
    var stillPending = loaded.some(function(wa: any) { return wa.gradingStatus === 'pending' })
    if (stillPending && !hwReviewAutoRefreshed.current[hwId]) {
      hwReviewAutoRefreshed.current[hwId] = true
      if (hwReviewTimers.current[hwId]) clearTimeout(hwReviewTimers.current[hwId])
      hwReviewTimers.current[hwId] = setTimeout(function() {
        delete hwReviewTimers.current[hwId]
        refreshHwReview(hwId)
      }, 12000)
    }
  }

  var handleExpandHw = function(hwId: string) {
    if (blockedHwId) { setBlockedHwId(null); return }
    if (submittedHwId) { setSubmittedHwId(null); setExpandedHw(null); return }
    if (expandedHw === hwId) { setExpandedHw(null); return }
    var hw = homework.find(function(h) { return h.id === hwId })
    if (!hw) return
    if (hwResults[hwId]) { setBlockedHwId(hwId); openHwReview(hwId); return }
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
          setHwResults(function(prev) { return { ...prev, [hwId]: { score: data.result.score, maxScore: data.result.maxScore, resultId: data.result.id } } })
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
        {/* (2026-و25 نقل 25-a) قسم مراجعة الأسئلة المقالية في شاشة «تم تقديم بالفعل» —
            كان مفقود خالص: الملاحظات بتتجهز من /api/homework/result/[id] عند الفتح
            + تحديث تلقائي واحد بعد 12 ثانية لو لسه بيتصحح */}
        {bWriting.length > 0 && (
          <div className="w-full max-w-2xl space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">مراجعة الأسئلة المقالية:</p>
            {bWriting.map(function(wa: any, wi: number) {
              var waPending = wa.gradingStatus === 'pending'
              /* (2026-و29) درجة جزئية → «جزئي» كهرماني بدل «غلط» أحمر — رسالة أصدق للطالب
                 (المستر هو اللي يأكد الحكم النهائي من اللوحة) */
              var waPartial = !waPending && wa.isCorrect !== true && ((wa.awardedPoints || 0) > 0) && wa.answer && String(wa.answer).trim()
              var badgeCls = waPending
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : (wa.isCorrect === true
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : (waPartial
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'))
              var badgeText = waPending ? 'بيتصحح دلوقتي…' : (wa.isCorrect === true ? 'صح ✓' : (waPartial ? 'جزئي' : 'غلط ✗'))
              return (
                <Card key={'bwr-' + wi} className={waPending ? 'border-amber-200 dark:border-amber-900/40' : (wa.isCorrect === true ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-red-200 dark:border-red-900/40')}>
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium min-w-0 whitespace-pre-wrap break-words">{wa.question}</p>
                      <Badge className={'text-[10px] shrink-0 ' + badgeCls}>{badgeText}</Badge>
                    </div>
                    {wa.answer && String(wa.answer).indexOf('[📷') < 0 && (
                      <p className="text-xs text-foreground whitespace-pre-wrap break-words" dir="auto">إجابتك: {wa.answer}</p>
                    )}
                    {!waPending && wa.awardedPoints !== undefined && (
                      <p className="text-[10px] font-semibold text-muted-foreground">الدرجة: {wa.awardedPoints}/{wa.maxPoints || wa.points}</p>
                    )}
                    {wa.aiExtractedAnswer && (
                      <p className="text-[10px] text-muted-foreground" dir="auto">🤖 قراءة إجابتك: {wa.aiExtractedAnswer}</p>
                    )}
                    {(wa.aiFeedback || wa.feedback) && !waPending && (
                      <div className={'mt-1 p-2.5 rounded-xl border-2 ' + (wa.isCorrect === true ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-700' : wa.isCorrect === false ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' : 'bg-muted/40 border-border')}>
                        <p className={'text-xs font-bold mb-1 flex items-center gap-1.5 ' + (wa.isCorrect === true ? 'text-emerald-700 dark:text-emerald-400' : wa.isCorrect === false ? 'text-red-700 dark:text-red-400' : 'text-foreground')}>
                          <span>📝</span> ملاحظة المصحح الذكي:
                        </p>
                        <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words" style={{ textAlign: 'right' }}>{wa.aiFeedback || wa.feedback}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
            {bPending && (
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <p className="text-sm text-amber-600 font-medium flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> بيتصحح دلوقتي… الملاحظات هتظهر بعد لحظات</p>
              </div>
            )}
            <Button
              variant="outline"
              onClick={function() { if (blockedHwId) refreshHwReview(blockedHwId) }}
              className="min-h-[44px] w-full sm:w-auto"
            >
              🔄 تحديث نتيجة التصحيح
            </Button>
          </div>
        )}
        {bWrong.length === 0 && !bWritingBad && !bPending && bScore && bScore.score === bScore.maxScore && (
          <p className="text-sm text-emerald-600 font-medium text-center">أحسنت يا بطل! 🎉 جميع الإجابات صحيحة والدرجة النهائية كاملة</p>
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
                              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">بيتصحح دلوقتي… النتيجة هتظهر هنا تلقائياً</p>
                            </div>
                          )}
                          {writingAns.aiExtractedAnswer && (
                            <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40">
                              <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 mb-1">🤖 الـ AI قري إجابتك:</p>
                              <p className="text-xs text-foreground whitespace-pre-wrap break-words" dir="auto">{writingAns.aiExtractedAnswer}</p>
                            </div>
                          )}
                          {writingAns.modelAnswer && (
                            <p className="text-xs text-emerald-600 whitespace-pre-wrap break-words" dir="auto">الإجابة النموذجية: {writingAns.modelAnswer}</p>
                          )}
                          {writingAns.awardedPoints !== undefined && (
                            <p className="text-[10px] font-semibold text-muted-foreground">الدرجة: {writingAns.awardedPoints}/{writingAns.maxPoints || writingAns.points}</p>
                          )}
                          {/* 2026-و23 — ملاحظة المصحح الذكي في آخر السؤال — صندوق واضح بلون الحكم */}
                          {(writingAns.aiFeedback || writingAns.feedback) && writingAns.gradingStatus !== 'pending' && (
                            <div className={'mt-2.5 p-3 rounded-xl border-2 ' + (writingAns.isCorrect === true ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-700' : writingAns.isCorrect === false ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' : 'bg-muted/40 border-border')}>
                              <p className={'text-xs font-bold mb-1 flex items-center gap-1.5 ' + (writingAns.isCorrect === true ? 'text-emerald-700 dark:text-emerald-400' : writingAns.isCorrect === false ? 'text-red-700 dark:text-red-400' : 'text-foreground')}>
                                <span>📝</span> ملاحظة المصحح الذكي:
                              </p>
                              <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words" style={{ textAlign: 'right' }}>{writingAns.aiFeedback || writingAns.feedback}</p>
                            </div>
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
          <p className="text-sm text-amber-600 font-medium flex items-center justify-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> بيتصحح دلوقتي… النتيجة النهائية هتتحدث تلقائياً</p>
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
  /* (و25 نقل 25-b2) مؤقت الامتحان الاختياري — الأدمن يحدد دقائق للامتحان
     والعداد بيبقى من أول فتح ويستمر عبر تحديث الصفحة (localStorage) */
  var [timeLeft, setTimeLeft] = useState<number | null>(null)
  var autoSubmitDoneRef = useRef(false)
  var submitInFlightRef = useRef(false)
  var latestAnswersRef = useRef(answers)
  latestAnswersRef.current = answers

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

  /* (و25 نقل 25-b2) التسليم الموحد — زرار الطالب والعداد التلقائي بيلتقوا هنا
     (نفس فلوت التسليم الأصلي حرفيًا + snapshot للإجابات عشان نداء العداد ما يتأثرش بالـ closure) */
  var submitExamNow = function(isAuto?: boolean) {
    if (!takingExam) return
    if (submitInFlightRef.current) return
    if (isAuto && (autoSubmitDoneRef.current || submitting)) return
    if (!isAuto && !examQuestions.every(function(q, qi) { return isWritingQuestion(q) || answers[qi] !== undefined })) return
    submitInFlightRef.current = true
    if (isAuto) autoSubmitDoneRef.current = true
    setSubmitting(true)
    var examIdAtSubmit = takingExam
    var ansSnapshot = latestAnswersRef.current
    var serverAnswers: Record<string, any> = {}
    var keys = Object.keys(ansSnapshot)
    for (var ki = 0; ki < keys.length; ki++) {
      var di = Number(keys[ki])
      var eq = examQuestions[di]
      var val = ansSnapshot[di]
      if (eq) {
        if (typeof val === 'number') {
          serverAnswers[String(eq._origIdx)] = eq._optMap ? eq._optMap[val] : val
        } else {
          serverAnswers[String(eq._origIdx)] = val
        }
      }
    }
    // Client-side timeout (120s — التصحيح المتزامن بيكمل أثناء التسليم)
    var submitController = new AbortController()
    var submitTimeout = setTimeout(function() { submitController.abort() }, 120000)
    fetch('/api/exams/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: studentId, examId: examIdAtSubmit, answers: serverAnswers }),
      signal: submitController.signal,
    })
    .then(function(r) { return r.json() })
    .then(function(data) {
      clearTimeout(submitTimeout)
      try { localStorage.removeItem('mg_exam_start_' + examIdAtSubmit + '_' + studentId) } catch (e) {}
      if (data && typeof data.score === 'number') {
        setLastResult(Object.assign({ examId: examIdAtSubmit }, data))
      }
      setSubmittedExamIds(function(prev) { var s = new Set(prev); if (examIdAtSubmit) s.add(examIdAtSubmit); return s })
      setSubmittedMsg(isAuto ? 'انتهى وقت الامتحان — تم تسليم إجاباتك' : 'تم تقديم هذا الامتحان')
    })
    .catch(function() {
      clearTimeout(submitTimeout)
      try { localStorage.removeItem('mg_exam_start_' + examIdAtSubmit + '_' + studentId) } catch (e) {}
      setSubmittedExamIds(function(prev) { var s = new Set(prev); if (examIdAtSubmit) s.add(examIdAtSubmit); return s })
      setSubmittedMsg(isAuto ? 'انتهى وقت الامتحان — تم تسليم إجاباتك' : 'تم تقديم هذا الامتحان')
    })
    .finally(function() { setSubmitting(false); submitInFlightRef.current = false })
  }

  /* (و25 نقل 25-b2) العداد التنازلي — يبدأ من أول فتح وبيكمل بعد أي refresh */
  var timedExam: any = null
  if (takingExam) {
    for (var tei = 0; tei < exams.length; tei++) { if (exams[tei].id === takingExam) { timedExam = exams[tei]; break } }
  }
  var timeLimitMin = timedExam ? (Number((timedExam as any).timeLimitMin) || 0) : 0
  useEffect(function() {
    if (!takingExam || timeLimitMin <= 0) { setTimeLeft(null); return }
    autoSubmitDoneRef.current = false
    var lsKey = 'mg_exam_start_' + takingExam + '_' + studentId
    var start = 0
    try {
      var stored = localStorage.getItem(lsKey)
      if (stored) start = Number(stored) || 0
      if (!start) { start = Date.now(); localStorage.setItem(lsKey, String(start)) }
    } catch (e) { start = Date.now() }
    var deadline = start + timeLimitMin * 60000
    var tick = function() {
      var remain = Math.floor((deadline - Date.now()) / 1000)
      setTimeLeft(remain > 0 ? remain : 0)
    }
    tick()
    var iv = setInterval(tick, 1000)
    return function() { clearInterval(iv) }
  }, [takingExam, timeLimitMin, studentId])

  /* (و25 نقل 25-b2) عند وصول العداد للصفر — تسليم تلقائي مرة واحدة بس */
  useEffect(function() {
    if (timeLeft === null || timeLeft > 0 || !takingExam) return
    if (autoSubmitDoneRef.current || submitInFlightRef.current) return
    submitExamNow(true)
  }, [timeLeft, takingExam])

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
        {/* (و25 نقل 25-b2) مراجعة الاختياري سؤال سؤال — لما المستر يفعّل «إظهار الإجابات» للامتحان */}
        {lastResult && lastResult.showResult === true && Array.isArray(lastResult.mcqResults) && lastResult.mcqResults.length > 0 && (
          <div className="w-full max-w-xl space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">مراجعة أسئلة الاختياري:</p>
            <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {lastResult.mcqResults.map(function(m: any, mi: number) {
                var mOk = m.isCorrect === true
                return (
                  <Card key={'mcq-' + mi} className={mOk ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-red-200 dark:border-red-900/40'}>
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium min-w-0">{m.question}</p>
                        <Badge className={'text-[10px] shrink-0 ' + (mOk ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white')}>
                          {mOk ? 'صح ✓' : 'غلط ✗'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        {mOk ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> : <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                        إجابتك: {m.studentAnswer || 'لم يتم الإجابة'}
                      </p>
                      {!mOk && m.correctAnswer && (
                        <p className="text-[10px] text-emerald-600">الإجابة الصحيحة: {m.correctAnswer}</p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
        {lastResult && lastResult.showResult === true && lastResult.writingPending === true && (
          <p className="w-full max-w-xl text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            ⏳ الأسئلة المقالية بتصحح بالذكاء الاصطناعي — ملاحظات المستر هتظهر خلال لحظات
          </p>
        )}
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

        {/* (و25 نقل 25-b2) العداد التنازلي — الامتحانات المحددة ليها وقت من الأدمن */}
        {timeLimitMin > 0 && (
          <div
            dir="rtl"
            className={"sticky top-0 z-40 flex items-center justify-center gap-2 w-full min-h-[44px] py-2.5 rounded-xl font-bold text-sm shadow-sm border backdrop-blur " + (
              timeLeft !== null && timeLeft <= 60
                ? 'bg-red-500/10 border-red-500/50 text-red-600 animate-pulse'
                : 'bg-primary/10 border-primary/40 text-primary'
            )}
          >
            <Timer className="h-4 w-4 shrink-0" />
            {timeLeft !== null && timeLeft > 0 ? (
              <>
                <span>الوقت المتبقي:</span>
                <span dir="ltr" className="font-mono tabular-nums">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
              </>
            ) : (
              <span>انتهى وقت الامتحان — جاري تسليم إجاباتك…</span>
            )}
          </div>
        )}

        {/* 2026-و19 — ورقة الامتحان جوه شاشة الحل: الطالب يفتحها كاملة في أي لحظة وهو بيحل */}
        {exam.filePath && (
          <a
            href={exam.filePath}
            target="_blank"
            rel="noopener noreferrer"
            className={(timeLimitMin > 0 ? 'sticky top-[52px] ' : 'sticky top-0 ') + "z-30 flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-sm text-amber-900 dark:text-amber-300 bg-amber-100/95 dark:bg-amber-900/40 border border-amber-400/60 shadow-sm backdrop-blur hover:bg-amber-200/95 dark:hover:bg-amber-900/60 transition-colors"}
            dir="rtl"
          >
            <FileText className="h-4 w-4 shrink-0" />
            ورقة الامتحان — اضغط في أي وقت لعرضها كاملة
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </a>
        )}
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
          disabled={!examQuestions.every(function(q, qi) { return isWritingQuestion(q) || answers[qi] !== undefined }) || submitting || (timeLimitMin > 0 && timeLeft === 0)}
          onClick={function() { submitExamNow(false) }}
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
                    {/* النموذج المخصص للطالب عشوائيًا (لو الامتحان فيه نماذج) */}
                    {(exam as any).modelName && (
                      <Badge className="text-[10px] bg-purple-500 text-white">
                        📄 {(exam as any).modelName}
                      </Badge>
                    )}
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
/* 2026-و19 — «الورق ما بيحملش كله» — المرفق بيتفتح كامل: صورة الورقة
 * قابلة للضغط بتفتح الصورة الأصلية كاملة (تبويب جديد + زوم المتصفح)
 * والـ PDF زرار واضح 44px — الطالب بيشوف الورقة كاملة مش مصغرة 48px */
function FileAttachment({ filePath, fileType }: { filePath: string; fileType: string }) {
  const isImage = fileType?.startsWith('image/')
  const isPdf = fileType === 'application/pdf'
  if (isImage) {
    return (
      <a href={filePath} target="_blank" rel="noopener noreferrer" className="inline-block group align-top" title="اضغط لعرض الورقة كاملة">
        <Image src={filePath} alt="ورقة الامتحان — اضغط للعرض الكامل" width={120} height={96} className="max-h-24 w-auto rounded-lg border group-hover:ring-2 ring-primary/60 transition-all" unoptimized />
        <span className="flex items-center gap-1 text-[11px] font-bold text-primary mt-1">
          <Search className="h-3 w-3" />
          اضغط لعرض الورقة كاملة
        </span>
      </a>
    )
  }
  return (
    <a href={filePath} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-bold shrink-0">
      <FileDown className="h-4 w-4" />
      {isPdf ? 'افتح الورقة كاملة (PDF)' : 'افتح الملف كامل'}
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


/* ========== Countdown Timer for scheduled videos (الجدولة القديمة) ========== */
function CountdownTimer({ unlockAt }: { unlockAt: Date }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    var interval = setInterval(function() {
      var now = Date.now()
      var diff = unlockAt.getTime() - now
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        clearInterval(interval)
        return
      }
      var days = Math.floor(diff / (1000 * 60 * 60 * 24))
      var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      var seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeLeft({ days, hours, minutes, seconds })
    }, 1000)
    return function() { clearInterval(interval) }
  }, [unlockAt])

  return (
    <div className="flex items-center justify-center gap-2 text-white">
      {timeLeft.days > 0 && (
        <div className="text-center">
          <div className="text-2xl font-bold bg-white/10 rounded-lg px-2 py-1 min-w-[40px]">{timeLeft.days}</div>
          <div className="text-[9px] text-white/70">يوم</div>
        </div>
      )}
      <div className="text-center">
        <div className="text-2xl font-bold bg-white/10 rounded-lg px-2 py-1 min-w-[40px]">{String(timeLeft.hours).padStart(2, '0')}</div>
        <div className="text-[9px] text-white/70">ساعة</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold bg-white/10 rounded-lg px-2 py-1 min-w-[40px]">{String(timeLeft.minutes).padStart(2, '0')}</div>
        <div className="text-[9px] text-white/70">دقيقة</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold bg-white/10 rounded-lg px-2 py-1 min-w-[40px]">{String(timeLeft.seconds).padStart(2, '0')}</div>
        <div className="text-[9px] text-white/70">ثانية</div>
      </div>
    </div>
  )
}
