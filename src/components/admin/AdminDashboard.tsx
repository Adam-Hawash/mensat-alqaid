'use client'
  
import { useAppStore, GRADES, GRADES_EN, GRADE_SHORT_NAMES, type Student, type Video as VideoType, type Homework, type Exam, type Announcement, type ExamResult, type GalleryImage, type Stats } from '@/stores/app-store'
import { chunkedUpload } from '@/lib/chunked-upload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Users, UserCheck, Clock, Video, ClipboardList, FileText,
  Megaphone, Plus, Check, X, Trash2, LogOut, Loader2,
  BarChart3, RefreshCw, Settings, Upload, MessageSquare,
  Link2, Activity, Eye, ImagePlus, Trophy, UserX, Camera,
  PlayCircle, Pause, Film, Search, FileDown, PictureInPicture2, Save, Sparkles, Wallet
} from 'lucide-react'
import { CMSPanel } from './CMSPanel'
import { SocialLinksPanel } from './SocialLinksPanel'
import { CommunityPanel } from './CommunityPanel'
import { ActivityPanel } from './ActivityPanel'
import { PaymentsPanel } from '@/components/PaymentsPanel'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'

export function AdminDashboard() {
  const { adminTab, setAdminTab, logout, currentAdmin, setCurrentAdmin } = useAppStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsOldPass, setSettingsOldPass] = useState('')
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsNewPass, setSettingsNewPass] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [resendApiKey, setResendApiKey] = useState('')
  const [resendSaving, setResendSaving] = useState(false)
  const [heroDevUrl, setHeroDevUrl] = useState('')
  const [heroDevSaving, setHeroDevSaving] = useState(false)
  const [heroDevLabel, setHeroDevLabel] = useState('')
  const [madeByLabel, setMadeByLabel] = useState('')
  const [heroLabelSaving, setHeroLabelSaving] = useState(false)
  const [vodafoneCash, setVodafoneCash] = useState('')
  const [instapay, setInstapay] = useState('')
  const [fawry, setFawry] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
    } catch { /* silent */ }
  }

  useEffect(() => { fetchStats() }, [])

  const openSettings = async () => {
    setShowSettings(true)
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      if (data.admin) {
        setSettingsEmail(data.admin.email || '')
        if (data.admin.email && setCurrentAdmin) setCurrentAdmin({ ...currentAdmin!, email: data.admin.email })
      }
      // Load Resend API key
      try {
        const cfgRes = await fetch('/api/config')
        const cfgData = await cfgRes.json()
        setResendApiKey(cfgData.resend_api_key || '')
        setHeroDevUrl(cfgData.hero_developer_url || '')
        setHeroDevLabel(cfgData.hero_developer_label || 'Hero Developer')
        setMadeByLabel(cfgData.footer_made_by_label || 'Made by Adam Hawash')
        setVodafoneCash(cfgData.payment_vodafone_cash || '')
        setInstapay(cfgData.payment_instapay || '')
        setFawry(cfgData.payment_fawry || '')
      } catch { /* silent */ }
    } catch { /* silent */ }
    setSettingsLoading(false)
  }

  const saveSettings = async () => {
    if (!settingsOldPass) { toast.error('أدخل كلمة المرور الحالية'); return }
    setSettingsSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: settingsOldPass, newEmail: settingsEmail, newPassword: settingsNewPass }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success('تم تحديث الإعدادات')
        if (data.admin && setCurrentAdmin) setCurrentAdmin(data.admin)
        setSettingsOldPass(''); setSettingsNewPass(''); setShowSettings(false)
      } else {
        try { const d = await res.json(); toast.error(d.error || 'خطأ') } catch { toast.error('خطأ في السيرفر') }
      }
    } catch { toast.error('خطأ في الاتصال') }
    setSettingsSaving(false)
  }

  return (
    <div className="flex-1 py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">لوحة التحكم | Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">إدارة المنصة التعليمية بالكامل</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStats}><RefreshCw className="h-4 w-4 ml-1" />تحديث</Button>
            <Button variant="outline" size="sm" onClick={openSettings}><Settings className="h-4 w-4 ml-1" />الإعدادات</Button>
            <Button variant="outline" size="sm" onClick={logout}><LogOut className="h-4 w-4 ml-1" />خروج</Button>
          </div>
        </div>

        {stats && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-6">
            <StatCard icon={Users} label="إجمالي الطلاب" value={stats.totalStudents} color="bg-[#0D9488]/10 text-[#0D9488]" />
            <StatCard icon={Clock} label="بانتظار الموافقة" value={stats.pendingStudents} color="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
            <StatCard icon={UserCheck} label="طلاب مفعلين" value={stats.approvedStudents} color="bg-teal-50 text-teal-600 dark:text-teal-400" />
            <StatCard icon={Video} label="إجمالي الفيديوهات" value={stats.totalVideos} color="bg-violet-50 text-violet-500 dark:text-violet-400" />
            <StatCard icon={Wallet} label="مدفوعات معلقة" value={(stats as any).pendingPayments || 0} color="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
          </div>
        )}

        <Tabs value={adminTab} onValueChange={setAdminTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="students" className="text-xs sm:text-sm gap-1"><Users className="h-4 w-4" /><span className="hidden sm:inline">الطلاب</span></TabsTrigger>
            <TabsTrigger value="my-students" className="text-xs sm:text-sm gap-1"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">طلابي</span></TabsTrigger>
            <TabsTrigger value="videos" className="text-xs sm:text-sm gap-1"><Video className="h-4 w-4" /><span className="hidden sm:inline">الفيديوهات</span></TabsTrigger>
            <TabsTrigger value="homework" className="text-xs sm:text-sm gap-1"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">الواجبات</span></TabsTrigger>
            <TabsTrigger value="exams" className="text-xs sm:text-sm gap-1"><FileText className="h-4 w-4" /><span className="hidden sm:inline">الامتحانات</span></TabsTrigger>
            <TabsTrigger value="announcements" className="text-xs sm:text-sm gap-1"><Megaphone className="h-4 w-4" /><span className="hidden sm:inline">الإعلانات</span></TabsTrigger>
            <TabsTrigger value="community" className="text-xs sm:text-sm gap-1"><MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">المجتمعات</span></TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm gap-1"><Activity className="h-4 w-4" /><span className="hidden sm:inline">المتابعة</span></TabsTrigger>
            <TabsTrigger value="gallery" className="text-xs sm:text-sm gap-1"><Camera className="h-4 w-4" /><span className="hidden sm:inline">معرض الصور</span></TabsTrigger>
            <TabsTrigger value="cms" className="text-xs sm:text-sm gap-1"><Settings className="h-4 w-4" /><span className="hidden sm:inline">المحتوى</span></TabsTrigger>
            <TabsTrigger value="social" className="text-xs sm:text-sm gap-1"><Link2 className="h-4 w-4" /><span className="hidden sm:inline">الروابط</span></TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm gap-1 text-amber-600 dark:text-amber-400"><Wallet className="h-4 w-4" /><span className="hidden sm:inline">المدفوعات</span></TabsTrigger>
            <TabsTrigger value="ai-extract" className="text-xs sm:text-sm gap-1 text-purple-600 dark:text-purple-400"><Sparkles className="h-4 w-4" /><span className="hidden sm:inline">استخراج AI</span></TabsTrigger>
          </TabsList>

          <TabsContent value="students"><StudentsManager onStatsRefresh={fetchStats} /></TabsContent>
          <TabsContent value="my-students"><MyStudentsPanel /></TabsContent>
          <TabsContent value="videos"><VideoManager onStatsRefresh={fetchStats} /></TabsContent>
          <TabsContent value="homework">
            <ContentManager<Homework> title="إدارة الواجبات" apiPath="/api/homework" itemName="homework"
              fields={{ title: { label: 'عنوان الواجب', type: 'text' }, content: { label: 'المحتوى', type: 'textarea' } }}
              renderTitle={(item) => item.title} renderSubtitle={(item) => item.content?.substring(0, 80) || (item.filePath ? `📎 ${item.fileType}` : '')}
              supportFileUpload fileCategory="homework" acceptedTypes=".pdf,.doc,.docx,image/*" supportAnswerKey supportThumbnail supportMCQ onRefresh={fetchStats} />
          </TabsContent>
          <TabsContent value="exams"><ExamTrackingPanel /></TabsContent>
          <TabsContent value="announcements">
            <ContentManager<Announcement> title="إدارة الإعلانات" apiPath="/api/announcements" itemName="announcements"
              fields={{ title: { label: 'العنوان', type: 'text' }, content: { label: 'المحتوى', type: 'textarea' } }}
              renderTitle={(item) => item.title} renderSubtitle={(item) => item.content?.substring(0, 100) + '...'} onRefresh={fetchStats} />
          </TabsContent>
          <TabsContent value="community"><CommunityPanel /></TabsContent>
          <TabsContent value="activity"><ActivityPanel /></TabsContent>
          <TabsContent value="gallery"><GalleryManager /></TabsContent>
          <TabsContent value="cms"><CMSPanel /></TabsContent>
          <TabsContent value="social"><SocialLinksPanel /></TabsContent>
          <TabsContent value="payments"><PaymentsPanel onRefresh={fetchStats} /></TabsContent>
          <TabsContent value="ai-extract"><AIExtractionPanel onRefresh={fetchStats} /></TabsContent>
        </Tabs>

        {/* Admin Settings Dialog */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <div className="bg-card border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold flex items-center gap-2"><Settings className="h-5 w-5 text-primary" />إعدادات الحساب</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(false)}><X className="h-4 w-4" /></Button>
              </div>
              {settingsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">البريد الإلكتروني الجديد</Label>
                    <Input value={settingsEmail} onChange={(e) => setSettingsEmail(e.target.value)} placeholder="admin@example.com" dir="ltr" type="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">كلمة المرور الجديدة (اختياري)</Label>
                    <Input value={settingsNewPass} onChange={(e) => setSettingsNewPass(e.target.value)} placeholder="6 حروف على الأقل" type="password" />
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-[10px] text-muted-foreground mb-2">لكي تحفظ التغييرات، أدخل كلمة المرور الحالية:</p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">كلمة المرور الحالية *</Label>
                      <Input value={settingsOldPass} onChange={(e) => setSettingsOldPass(e.target.value)} placeholder="أدخل كلمة المرور الحالية" type="password" className="border-destructive/30 focus-visible:ring-destructive/30" />
                    </div>
                  </div>
                  {/* Resend API Key */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground">مفتاح Resend API للإيميلات</p>
                      <Button size="sm" variant="outline" onClick={async () => {
                        setResendSaving(true)
                        try {
                          await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resend_api_key: resendApiKey }) })
                          toast.success('تم حفظ مفتاح Resend')
                        } catch { toast.error('خطأ في الحفظ') }
                        setResendSaving(false)
                      }} disabled={resendSaving}>
                        {resendSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                    </div>
                    <Input value={resendApiKey} onChange={(e) => setResendApiKey(e.target.value)} placeholder="re_xxxxxxxxxxxx" dir="ltr" type="password" className="font-mono text-xs" />
                    <p className="text-[10px] text-muted-foreground">يُستخدم لإرسال إشعارات بالبريد للطلاب. احصل عليه من resend.com</p>
                  </div>
                  {/* Hero Developer Portfolio URL */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground">رابط Hero Developer Portfolio</p>
                      <Button size="sm" variant="outline" onClick={async () => {
                        setHeroDevSaving(true)
                        try {
                          const res = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hero_developer_url: heroDevUrl }) })
                          if (res.ok) {
                            // Update siteConfig in store so footer/hero reflect instantly
                            const cfg = useAppStore.getState().siteConfig
                            useAppStore.getState().setSiteConfig({ ...cfg, hero_developer_url: heroDevUrl })
                            toast.success('تم حفظ رابط Hero Developer')
                          } else { toast.error('خطأ في الحفظ') }
                        } catch { toast.error('خطأ في الحفظ') }
                        setHeroDevSaving(false)
                      }} disabled={heroDevSaving}>
                        {heroDevSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                    </div>
                    <Input value={heroDevUrl} onChange={(e) => setHeroDevUrl(e.target.value)} placeholder="https://hero-developer-portfolio-11.vercel.app" dir="ltr" type="url" className="font-mono text-xs" />
                    <p className="text-[10px] text-muted-foreground">الرابط يظهر في الفوتر. غيّره في أي وقت وبيتنعكس فوراً.</p>
                  </div>
                  {/* Hero Developer & Made by Labels */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground">كلمات المُطوّر (Hero Developer / Made by)</p>
                      <Button size="sm" variant="outline" onClick={async () => {
                        setHeroLabelSaving(true)
                        try {
                          const res = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hero_developer_label: heroDevLabel, footer_made_by_label: madeByLabel }) })
                          if (res.ok) {
                            const cfg = useAppStore.getState().siteConfig
                            useAppStore.getState().setSiteConfig({ ...cfg, hero_developer_label: heroDevLabel, footer_made_by_label: madeByLabel })
                            toast.success('تم حفظ كلمات المُطوّر')
                          } else { toast.error('خطأ في الحفظ') }
                        } catch { toast.error('خطأ في الحفظ') }
                        setHeroLabelSaving(false)
                      }} disabled={heroLabelSaving}>
                        {heroLabelSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">كلمة Hero Developer (النص الظاهر)</Label>
                      <Input value={heroDevLabel} onChange={(e) => setHeroDevLabel(e.target.value)} placeholder="Hero Developer" className="text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">كلمة Made by ... (النص الظاهر في الفوتر)</Label>
                      <Input value={madeByLabel} onChange={(e) => setMadeByLabel(e.target.value)} placeholder="Made by Adam Hawash" className="text-xs" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">غيّر النصوص اللي بتظهر جنب أيقونة المُطوّر في الفوتر. مثلاً ممكن تكتب "Developed by Adam Hawash" أو أي كلمات تختارها.</p>
                  </div>
                  {/* Payment Numbers */}
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground">أرقام الدفع (تظهر للطالب عند الدفع)</p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">فودافون كاش</Label>
                      <Input value={vodafoneCash} onChange={(e) => setVodafoneCash(e.target.value)} placeholder="01012345678" dir="ltr" className="font-mono text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">إنستا باي</Label>
                      <Input value={instapay} onChange={(e) => setInstapay(e.target.value)} placeholder="@username" dir="ltr" className="font-mono text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">فوري</Label>
                      <Input value={fawry} onChange={(e) => setFawry(e.target.value)} placeholder="01098765432" dir="ltr" className="font-mono text-xs" />
                    </div>
                    <Button className="w-full" onClick={async () => {
                      setPaymentSaving(true)
                      try {
                        const res = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_vodafone_cash: vodafoneCash, payment_instapay: instapay, payment_fawry: fawry }) })
                        if (res.ok) {
                          const cfg = useAppStore.getState().siteConfig
                          useAppStore.getState().setSiteConfig({ ...cfg, payment_vodafone_cash: vodafoneCash, payment_instapay: instapay, payment_fawry: fawry })
                          toast.success('تم حفظ أرقام الدفع')
                        } else { toast.error('خطأ في الحفظ') }
                      } catch { toast.error('خطأ في الحفظ') }
                      setPaymentSaving(false)
                    }} disabled={paymentSaving}>
                      {paymentSaving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                      {paymentSaving ? 'جاري الحفظ...' : 'حفظ أرقام الدفع'}
                    </Button>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={saveSettings} disabled={settingsSaving || !settingsOldPass} className="flex-1">
                      {settingsSaving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                      {settingsSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowSettings(false); setSettingsOldPass(''); setSettingsNewPass('') }}>إلغاء</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ========== STAT CARD ========== */
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
        <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
      </CardContent>
    </Card>
  )
}

/* ========== STUDENTS MANAGER ========== */
function StudentsManager({ onStatsRefresh }: { onStatsRefresh: () => void }) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [filterGrade, setFilterGrade] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [studentProgress, setStudentProgress] = useState<any>(null)
  const [loadingProgress, setLoadingProgress] = useState(false)

  const loadStudents = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '100' })
      if (filter !== 'all') params.set('status', filter)
      if (filterGrade) params.set('grade', filterGrade)
      const res = await fetch(`/api/students?${params}`)
      const data = await res.json()
      setStudents(data.students || [])
    } catch { toast.error('خطأ في تحميل الطلاب') }
    setLoading(false)
  }

  useEffect(() => { loadStudents() }, [filter, filterGrade])

  const loadStudentProgress = async (studentId: string) => {
    setSelectedStudentId(studentId)
    setLoadingProgress(true)
    try {
      const res = await fetch(`/api/students/${studentId}/progress`)
      const data = await res.json()
      setStudentProgress(data)
    } catch { toast.error('خطأ في تحميل بيانات الطالب') }
    setLoadingProgress(false)
  }

  const closeStudentDetails = () => {
    setSelectedStudentId(null)
    setStudentProgress(null)
  }

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await fetch(`/api/students/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      toast.success(status === 'approved' ? 'تم قبول الطالب' : 'تم رفض الطالب')
      loadStudents(false); onStatsRefresh()
    } catch { toast.error('خطأ في تحديث حالة الطالب') }
  }

  const handleDelete = async (id: string) => {
    try { await fetch(`/api/students/${id}`, { method: 'DELETE' }); toast.success('تم حذف الطالب'); loadStudents(false); onStatsRefresh() }
    catch { toast.error('خطأ في حذف الطالب') }
  }

  const statusColors: Record<string, string> = { pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', approved: 'bg-teal-50 text-teal-700 dark:bg-emerald-900/30 dark:text-emerald-400', rejected: 'bg-rose-50 text-rose-400 dark:bg-red-900/30 dark:text-red-400' }
  const statusLabels: Record<string, string> = { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض' }

  // Student Details Panel
  if (selectedStudentId && studentProgress) {
    const { summary, videoProgress: vp, examResults: er } = studentProgress
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">تفاصيل الطالب: {studentProgress.student.name}</CardTitle>
            <Button variant="outline" size="sm" onClick={closeStudentDetails}>رجوع</Button>
          </div>
          <p className="text-xs text-muted-foreground">الصف: {studentProgress.student.grade}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-purple-500/10"><p className="text-xl font-bold text-purple-600 dark:text-purple-400">{summary.totalVideosWatched}</p><p className="text-[10px] text-muted-foreground">فيديو شاهده</p></div>
            <div className="text-center p-3 rounded-lg bg-blue-500/10"><p className="text-xl font-bold text-blue-600 dark:text-blue-400">{summary.avgWatchPercent}%</p><p className="text-[10px] text-muted-foreground">متوسط المشاهدة</p></div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/10"><p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{summary.avgExamScore}</p><p className="text-[10px] text-muted-foreground">متوسط الامتحانات</p></div>
            <div className="text-center p-3 rounded-lg bg-amber-500/10"><p className="text-xl font-bold text-amber-600 dark:text-amber-400">{summary.examsPassed}/{summary.totalExamsTaken}</p><p className="text-[10px] text-muted-foreground">شاطر/إجمالي</p></div>
          </div>

          {/* Video Progress */}
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><PlayCircle className="h-4 w-4 text-purple-500" />تقدم الفيديوهات ({summary.completedVideos} مكتمل من {summary.totalVideosWatched})</h4>
            {vp.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">لم يشاهد أي فيديو بعد</p>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                {vp.map((v: any) => (
                  <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{v.videoTitle}</p>
                      <p className="text-[10px] text-muted-foreground">{v.videoGrade} | آخر مشاهدة: {new Date(v.lastWatchedAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                    <div className="shrink-0 text-left" style={{ minWidth: '60px' }}>
                      <div className={`text-xs font-bold ${v.percent >= 90 ? 'text-teal-600' : v.percent >= 50 ? 'text-amber-600' : 'text-rose-400'}`}>{v.percent}%</div>
                      <div className="h-1.5 w-full bg-muted rounded-full mt-1"><div className={`h-full rounded-full ${v.percent >= 90 ? 'bg-teal-500' : v.percent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${v.percent}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Exam Results */}
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />نتائج الامتحانات</h4>
            {er.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">لم يؤدِ أي امتحان بعد</p>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                {er.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{e.examTitle}</p>
                      <p className="text-[10px] text-muted-foreground">{e.examGrade} | {new Date(e.submittedAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                    <div className="shrink-0 text-left" style={{ minWidth: '60px' }}>
                      <div className={`text-xs font-bold ${e.passed ? 'text-emerald-600' : 'text-rose-400'}`}>{e.score}/{e.maxScore}</div>
                      <Badge className={`text-[9px] mt-1 ${e.passed ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-400'}`}>{e.passed ? 'شاطر' : 'عايز مراجعة على الدروس'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading student details
  if (selectedStudentId && loadingProgress) {
    return (
      <Card>
        <CardContent className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">إدارة الطلاب</CardTitle>
          <div className="flex gap-1 flex-wrap items-center">
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
              <option value="">كل الصفوف</option>
              {GRADES_EN.map((g) => <option key={g.ar} value={g.ar}>{g.ar} {g.en}</option>)}
            </select>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(['pending', 'all', 'approved', 'rejected'] as const).map((f) => (
                <Button key={f} variant={filter === f ? 'default' : 'ghost'} size="sm" className="text-xs h-7 px-2" onClick={() => setFilter(f)}>
                  {f === 'pending' ? 'بانتظار' : f === 'approved' ? 'مقبول' : f === 'rejected' ? 'مرفوض' : 'الكل'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : students.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">لا يوجد طلاب</p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
            {students.map((s) => (
              <div key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{s.name}</span>
                    <Badge variant="secondary" className={`text-[10px] ${statusColors[s.status]}`}>{statusLabels[s.status]}</Badge>
                    {s.loginCount > 0 && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Eye className="h-3 w-3" />{s.loginCount} دخول</span>}
                    {(s as any).watchedVideoCount > 0 && <span className="text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-0.5"><Video className="h-3 w-3" />{(s as any).watchedVideoCount} فيديو</span>}
                  </div>
                  <p className="text-xs text-muted-foreground" dir="ltr">{s.phone}</p>
                  <p className="text-xs text-muted-foreground">ولي الأمر: {s.parentName} <span dir="ltr">({s.parentPhone})</span></p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{s.grade}</Badge>
                    {s.lastLogin && <p className="text-[10px] text-muted-foreground">آخر دخول: {new Date(s.lastLogin).toLocaleDateString('ar-EG')}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => loadStudentProgress(s.id)} title="تفاصيل"><BarChart3 className="h-4 w-4" /></Button>
                  {s.status === 'pending' && (<>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => handleAction(s.id, 'approved')}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleAction(s.id, 'rejected')}><X className="h-4 w-4" /></Button>
                  </>)}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ========== VIDEO MANAGER (with REAL XHR upload progress) ========== */
function VideoManager({ onStatsRefresh }: { onStatsRefresh: () => void }) {
  const [videos, setVideos] = useState<VideoType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formGrade, setFormGrade] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [formThumbnail, setFormThumbnail] = useState<File | null>(null)
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const videoFileRef = useRef<HTMLInputElement>(null)
  const thumbFileRef = useRef<HTMLInputElement>(null)

  const loadVideos = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '100' })
      if (filterGrade) params.set('grade', filterGrade)
      const res = await fetch(`/api/videos?${params}`)
      if (!res.ok) {
        try { const errData = await res.json(); toast.error('خطأ في تحميل الفيديوهات: ' + (errData.error || ''), { duration: 8000 }) } catch { toast.error('خطأ في السيرفر', { duration: 8000 }) }
      } else {
        const data = await res.json()
        setVideos(data.videos || [])
      }
    } catch (err: any) { toast.error('خطأ: ' + (err.message || ''), { duration: 8000 }) }
    setLoading(false)
  }

  useEffect(() => { loadVideos() }, [filterGrade])

  // Upload using shared chunked upload utility
  const uploadFileWithProgress = async (file: File, category: string, onProgress: (pct: number) => void, statusMsg: (msg: string) => void): Promise<string> => {
    const result = await chunkedUpload(file, category, onProgress, statusMsg)
    return result.filePath
  }

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formGrade) { toast.error('أدخل العنوان واختر الصف'); return }
    if (!formUrl && !formFile) { toast.error('أدخل رابط YouTube أو ارفع ملف فيديو'); return }
    setSubmitting(true)
    setUploading(true)
    try {
      let videoPath = ''
      let videoType = ''
      let thumbnailPath = ''

      if (formFile) {
        setUploadStatus('جاري رفع الفيديو...')
        videoPath = await uploadFileWithProgress(formFile, 'videos', setUploadProgress, setUploadStatus)
        videoType = formFile.type
      }

      if (formThumbnail) {
        setUploadStatus('جاري رفع الصورة المصغرة...')
        setUploadProgress(0)
        thumbnailPath = await uploadFileWithProgress(formThumbnail, 'thumbnails', setUploadProgress, setUploadStatus)
      }

      setUploadStatus('جاري الحفظ...')
      const body: Record<string, string> = {
        title: formTitle.trim(),
        grade: formGrade,
        url: formUrl.trim(),
        price: formPrice.trim() || '0',
      }
      if (videoPath) { body.filePath = videoPath; body.fileType = videoType }
      if (thumbnailPath) { body.thumbnail = thumbnailPath }
      else if (formThumbnailUrl.trim()) { body.thumbnail = formThumbnailUrl.trim() }

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success('تم إضافة الفيديو بنجاح! سيظهر للصف ' + formGrade)
        setShowForm(false)
        setFormTitle(''); setFormUrl(''); setFormGrade(''); setFormPrice('')
        setFormFile(null); setFormThumbnail(null); setFormThumbnailUrl('')
        loadVideos(false)
        onStatsRefresh()
      } else {
        try { const d = await res.json(); toast.error(d.error || 'خطأ في الإضافة', { duration: 8000 }) } catch { toast.error('خطأ في السيرفر - حاول تاني', { duration: 8000 }) }
      }
    } catch (err: any) {
      toast.error('خطأ في الاتصال: ' + (err.message || ''), { duration: 8000 })
    }
    setSubmitting(false)
    setUploading(false)
    setUploadProgress(0)
    setUploadStatus('')
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/videos/${id}`, { method: 'DELETE' })
      toast.success('تم حذف الفيديو')
      loadVideos(false)
      onStatsRefresh()
    } catch { toast.error('خطأ في الحذف') }
  }

  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/)
    return match ? match[1] : null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2"><Film className="h-5 w-5 text-primary" />إدارة الفيديوهات</CardTitle>
          <div className="flex gap-2 items-center flex-wrap">
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">كل الصفوف</option>
              {GRADES_EN.map((g) => <option key={g.ar} value={g.ar}>{g.ar} {g.en}</option>)}
            </select>
            <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 ml-1" />إضافة فيديو</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Video Form */}
        {showForm && (
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Plus className="h-4 w-4" />إضافة فيديو جديد</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">الصف الدراسي *</Label>
                <select value={formGrade} onChange={(e) => setFormGrade(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="">اختر الصف</option>{GRADES_EN.map((g) => <option key={g.ar} value={g.ar}>{g.ar} {g.en}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">عنوان الدرس *</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="مثال: الباب الأول - الكسور" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">السعر (ج.م) — اتركه فاضي للمجاني</Label>
                <Input value={formPrice} onChange={(e) => setFormPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" dir="ltr" type="number" min="0" step="0.01" />
              </div>
            </div>

            {/* YouTube URL */}
            <div className="space-y-1.5">
              <Label className="text-xs">رابط YouTube (اختياري - أو ارفع ملف فيديو)</Label>
              <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." dir="ltr" />
              {formUrl && getYouTubeId(formUrl) && (
                <div className="mt-2 w-40 aspect-video rounded-lg overflow-hidden border relative">
                  <Image src={`https://img.youtube.com/vi/${getYouTubeId(formUrl)}/mqdefault.jpg`} alt="thumbnail" fill className="object-cover" sizes="400px" unoptimized />
                </div>
              )}
            </div>

            {/* Video File Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs">أو ارفع ملف فيديو</Label>
              <div className="flex items-center gap-2">
                <input ref={videoFileRef} type="file" accept="video/*" className="hidden" onChange={(e) => { setFormFile(e.target.files?.[0] || null) }} />
                <Button type="button" variant="outline" size="sm" onClick={() => videoFileRef.current?.click()}>
                  <Upload className="h-4 w-4 ml-1" />{formFile ? formFile.name : 'اختر فيديو'}
                </Button>
                {formFile && <span className="text-xs text-muted-foreground">{(formFile.size / 1024 / 1024).toFixed(1)} MB</span>}
              </div>
            </div>

            {/* Thumbnail Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs">صورة مصغرة للفيديو (اختياري)</Label>
              <div className="flex items-center gap-3">
                <input ref={thumbFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { setFormThumbnail(e.target.files?.[0] || null) }} />
                <Button type="button" variant="outline" size="sm" onClick={() => thumbFileRef.current?.click()}>
                  <PictureInPicture2 className="h-4 w-4 ml-1" />{formThumbnail ? formThumbnail.name : 'اختر صورة'}
                </Button>
                {formThumbnail && (
                  <div className="w-16 h-10 rounded border overflow-hidden relative">
                    <Image src={URL.createObjectURL(formThumbnail)} alt="thumb" fill className="object-cover" unoptimized />
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail URL */}
            <div className="space-y-1.5">
              <Label className="text-xs">أو رابط صورة مصغرة (اختياري)</Label>
              <Input value={formThumbnailUrl} onChange={(e) => setFormThumbnailUrl(e.target.value)} placeholder="https://example.com/thumbnail.jpg" dir="ltr" />
              {formThumbnailUrl && (
                <div className="mt-2 w-40 aspect-video rounded-lg overflow-hidden border relative">
                  <Image src={formThumbnailUrl} alt="thumbnail" fill className="object-cover" sizes="400px" unoptimized />
                </div>
              )}
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {uploadStatus || 'جاري الرفع...'} {uploadProgress}%
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={submitting || uploading}>
                {submitting || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ ونشر'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setFormTitle(''); setFormUrl(''); setFormGrade(''); setFormFile(null); setFormThumbnail(null); setFormThumbnailUrl('') }}>إلغاء</Button>
            </div>
          </div>
        )}

        {/* Video List */}
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : videos.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">لا توجد فيديوهات. أضف أول فيديو!</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => {
              const ytId = getYouTubeId(v.url)
              const thumb = v.thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null)
              return (
                <div key={v.id} className="rounded-lg border bg-card overflow-hidden group">
                  <div className="relative aspect-video bg-black">
                    {thumb ? (
                      <Image src={thumb} alt={v.title} fill className="object-cover" sizes="200px" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Video className="h-8 w-8 text-white/30" /></div>
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <PlayCircle className="h-10 w-10 text-white" />
                    </div>
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="font-semibold text-sm truncate">{v.title}</p>
                    <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">{GRADE_SHORT_NAMES[v.grade] || v.grade}</Badge>
                      <div className="flex items-center gap-1">
                        {v.filePath && <Badge variant="secondary" className="text-[10px]">📎 ملف</Badge>}
                        {v.url && !v.filePath && <Badge variant="secondary" className="text-[10px]">▶ YouTube</Badge>}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{new Date(v.createdAt).toLocaleDateString('ar-EG')}</p>
                    <Button size="sm" variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7" onClick={() => handleDelete(v.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />حذف
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ========== EXAM TRACKING PANEL ========== */
interface MCQQuestion {
  q: string
  options: string[]
  correct: number
  points: number
}

function ExamTrackingPanel() {
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExam, setSelectedExam] = useState<string>('')
  const [results, setResults] = useState<ExamResult[]>([])
  const [notTaken, setNotTaken] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formGrade, setFormGrade] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [formFilePath, setFormFilePath] = useState('')
  const [formFileType, setFormFileType] = useState('')
  const [formFileUrl, setFormFileUrl] = useState('')
  const [formPassScore, setFormPassScore] = useState(50)
  const [formQuestions, setFormQuestions] = useState<MCQQuestion[]>([])
  const [showQBuilder, setShowQBuilder] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatusMsg, setUploadStatusMsg] = useState('')
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null)
  const [answerKeyPath, setAnswerKeyPath] = useState('')
  const [answerKeyType, setAnswerKeyType] = useState('')
  const [answerKeyUrl, setAnswerKeyUrl] = useState('')
  const [uploadingAnswerKey, setUploadingAnswerKey] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const answerKeyRef = useRef<HTMLInputElement>(null)
  const thumbnailRef = useRef<HTMLInputElement>(null)

  const loadExams = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exams?pageSize=100')
      if (!res.ok) {
        try { const errData = await res.json(); toast.error('خطأ في تحميل الامتحانات: ' + (errData.error || ''), { duration: 8000 }) } catch { toast.error('خطأ في السيرفر', { duration: 8000 }) }
      } else {
        const data = await res.json()
        setExams(data.exams || [])
      }
    } catch (err: any) { toast.error('خطأ: ' + (err.message || ''), { duration: 8000 }) }
    setLoading(false)
  }

  useEffect(() => { loadExams() }, [])

  const loadExamResults = async (examId: string) => {
    if (!examId) { setResults([]); setNotTaken([]); return }
    try {
      const res = await fetch(`/api/exam-results?examId=${examId}`)
      const data = await res.json()
      setResults(data.results || [])
      setNotTaken(data.notTaken || [])
    } catch { toast.error('خطأ في تحميل النتائج') }
  }

  const handleExamSelect = (examId: string) => {
    setSelectedExam(examId)
    loadExamResults(examId)
  }

  const handleAddExam = async () => {
    if (!formTitle.trim() || !formGrade) { toast.error('أدخل العنوان واختر الصف'); return }
    setSubmitting(true)
    try {
      // Use local variables to avoid React state batching issues
      let localFilePath = formFilePath || ''
      let localFileType = formFileType || ''
      let localAnswerKeyPath = answerKeyPath || ''
      let localAnswerKeyType = answerKeyType || ''
      let localThumbnailPath = thumbnailPath || ''

      // Upload question paper (URL fallback or file upload)
      if (!localFilePath && (formFile || formFileUrl.trim())) {
        if (formFileUrl.trim()) {
          localFilePath = formFileUrl.trim()
          localFileType = ''
          setFormFilePath(localFilePath)
          setFormFileType('')
        } else if (formFile) {
          setUploading(true)
          setUploadStatusMsg('جاري رفع نموذج الأسئلة...')
          try {
            const upData = await chunkedUpload(formFile, 'exams', undefined, (msg) => setUploadStatusMsg(msg))
            localFilePath = upData.filePath
            localFileType = upData.fileType
            setFormFilePath(upData.filePath)
            setFormFileType(upData.fileType)
          } catch (err: any) {
            toast.error(err.message || 'فشل رفع نموذج الأسئلة')
            setUploading(false); setUploadStatusMsg(''); setSubmitting(false); return
          }
          setUploading(false)
        }
      }
      // Upload answer key (URL fallback or file upload)
      if (!localAnswerKeyPath && (answerKeyFile || answerKeyUrl.trim())) {
        if (answerKeyUrl.trim()) {
          localAnswerKeyPath = answerKeyUrl.trim()
          localAnswerKeyType = ''
          setAnswerKeyPath(localAnswerKeyPath)
          setAnswerKeyType('')
        } else if (answerKeyFile) {
          setUploadingAnswerKey(true)
          setUploadStatusMsg('جاري رفع نموذج الإجابة...')
          try {
            const upData = await chunkedUpload(answerKeyFile, 'exams', undefined, (msg) => setUploadStatusMsg(msg))
            localAnswerKeyPath = upData.filePath
            localAnswerKeyType = upData.fileType
            setAnswerKeyPath(upData.filePath)
            setAnswerKeyType(upData.fileType)
          } catch (err: any) {
            toast.error(err.message || 'فشل رفع نموذج الإجابة')
            setUploadingAnswerKey(false); setUploadStatusMsg(''); setSubmitting(false); return
          }
          setUploadingAnswerKey(false)
        }
      }
      // Upload thumbnail (URL fallback or file upload)
      if (!localThumbnailPath && (thumbnailFile || thumbnailUrl.trim())) {
        if (thumbnailUrl.trim()) {
          localThumbnailPath = thumbnailUrl.trim()
          setThumbnailPath(localThumbnailPath)
        } else if (thumbnailFile) {
          setUploading(true)
          setUploadStatusMsg('جاري رفع الصورة المصغرة...')
          try {
            const upData = await chunkedUpload(thumbnailFile, 'exams', undefined, (msg) => setUploadStatusMsg(msg))
            localThumbnailPath = upData.filePath
            setThumbnailPath(upData.filePath)
          } catch (err: any) {
            toast.error(err.message || 'فشل رفع الصورة المصغرة')
            setUploading(false); setUploadStatusMsg(''); setSubmitting(false); return
          }
          setUploading(false)
        }
      }
      setUploadStatusMsg('')
      const body: Record<string, string> = { title: formTitle, grade: formGrade, content: formContent }
      if (localFilePath) { body.filePath = localFilePath; body.fileType = localFileType }
      if (localAnswerKeyPath) { body.answerKeyPath = localAnswerKeyPath; body.answerKeyType = localAnswerKeyType }
      if (localThumbnailPath) { body.thumbnail = localThumbnailPath }
      if (formQuestions.length > 0) { body.questions = JSON.stringify(formQuestions); body.passScore = String(formPassScore) }
      const res = await fetch('/api/exams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        toast.success('تم إضافة الامتحان'); setShowForm(false); setFormTitle(''); setFormContent(''); setFormGrade(''); setFormFile(null); setFormFilePath(''); setFormFileType(''); setFormFileUrl(''); setFormQuestions([]); setFormPassScore(50); setAnswerKeyFile(null); setAnswerKeyPath(''); setAnswerKeyType(''); setAnswerKeyUrl(''); setThumbnailFile(null); setThumbnailPath(''); setThumbnailUrl(''); loadExams()
      } else { try { const d = await res.json(); toast.error(d.error || 'خطأ', { duration: 8000 }) } catch { toast.error('خطأ في السيرفر - حاول تاني', { duration: 8000 }) } }
    } catch (err: any) { toast.error('خطأ في الاتصال: ' + (err.message || ''), { duration: 8000 }) }
    setSubmitting(false)
  }

  const handleDeleteExam = async (id: string) => {
    try { await fetch(`/api/exams/${id}`, { method: 'DELETE' }); toast.success('تم حذف الامتحان'); loadExams(); if (selectedExam === id) { setSelectedExam(''); setResults([]); setNotTaken([]) } } catch { toast.error('خطأ') }
  }

  const avgScore = results.length > 0 ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1) : '—'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />تتبع الامتحانات</CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 ml-1" />إضافة امتحان</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <h4 className="font-semibold text-sm">إضافة امتحان جديد</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs">الصف</Label>
                <select value={formGrade} onChange={(e) => setFormGrade(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="">اختر الصف</option>{GRADES_EN.map((g) => <option key={g.ar} value={g.ar}>{g.ar} {g.en}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">العنوان</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="عنوان الامتحان" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">المحتوى</Label>
              <Textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={3} /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">نموذج الأسئلة (رفع ملف أو رابط) - يعرض للطلاب</Label>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => { setFormFile(e.target.files?.[0] || null); setFormFilePath(''); setFormFileUrl('') }} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 ml-1" />{formFile ? formFile.name : 'رفع ملف'}</Button>
                {formFile && <span className="text-xs text-muted-foreground">{(formFile.size / 1024 / 1024).toFixed(1)} MB</span>}
                {uploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground shrink-0">أو رابط:</span>
                <Input placeholder="https://..." value={formFileUrl} onChange={(e) => { setFormFileUrl(e.target.value); if (e.target.value.trim()) { setFormFile(null); setFormFilePath('') } }} dir="ltr" className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">نموذج الإجابة (رفع ملف أو رابط) - للتصحيح</Label>
              <div className="flex items-center gap-2">
                <input ref={answerKeyRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => { setAnswerKeyFile(e.target.files?.[0] || null); setAnswerKeyPath(''); setAnswerKeyUrl('') }} />
                <Button type="button" variant="outline" size="sm" onClick={() => answerKeyRef.current?.click()}><FileDown className="h-4 w-4 ml-1" />{answerKeyFile ? answerKeyFile.name : 'رفع ملف'}</Button>
                {answerKeyFile && <span className="text-xs text-muted-foreground">{(answerKeyFile.size / 1024 / 1024).toFixed(1)} MB</span>}
                {uploadingAnswerKey && <Loader2 className="h-4 w-4 animate-spin text-amber-500" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground shrink-0">أو رابط:</span>
                <Input placeholder="https://..." value={answerKeyUrl} onChange={(e) => { setAnswerKeyUrl(e.target.value); if (e.target.value.trim()) { setAnswerKeyFile(null); setAnswerKeyPath('') } }} dir="ltr" className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">صورة مصغرة (اختياري - رفع أو رابط)</Label>
              <div className="flex items-center gap-3">
                <input ref={thumbnailRef} type="file" accept="image/*" className="hidden" onChange={(e) => { setThumbnailFile(e.target.files?.[0] || null); setThumbnailPath(''); setThumbnailUrl('') }} />
                <Button type="button" variant="outline" size="sm" onClick={() => thumbnailRef.current?.click()}><PictureInPicture2 className="h-4 w-4 ml-1" />{thumbnailFile ? thumbnailFile.name : 'رفع صورة'}</Button>
                {thumbnailPath && <div className="w-12 h-8 rounded border overflow-hidden relative"><Image src={thumbnailPath} alt="thumb" fill className="object-cover" sizes="48px" unoptimized /></div>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground shrink-0">أو رابط:</span>
                <Input placeholder="https://..." value={thumbnailUrl} onChange={(e) => { setThumbnailUrl(e.target.value); if (e.target.value.trim()) { setThumbnailFile(null); setThumbnailPath('') } }} dir="ltr" className="h-8 text-xs" />
              </div>
            </div>
            {uploadStatusMsg && <p className="text-xs text-primary animate-pulse">{uploadStatusMsg}</p>}

            {/* MCQ Question Builder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">أسئلة اختيار من متعدد (اختياري - تصحيح أوتوماتيك)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowQBuilder(!showQBuilder)}>
                  {showQBuilder ? 'إخفاء' : '+ إضافة أسئلة MCQ'}
                </Button>
              </div>
              {showQBuilder && (
                <div className="space-y-3 p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs shrink-0">درجة النجاح</Label>
                    <Input type="number" value={formPassScore} onChange={(e) => setFormPassScore(Number(e.target.value))} className="w-20 h-8 text-sm" min={0} max={100} />
                    <span className="text-xs text-muted-foreground">/ 100</span>
                    <span className="text-xs text-muted-foreground mr-auto">{formQuestions.length} سؤال | {formQuestions.reduce((s, q) => s + q.points, 0)} درجة</span>
                  </div>
                  {formQuestions.map((q, qi) => (
                    <div key={qi} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-primary mt-1.5">{qi + 1}</span>
                        <Input value={q.q} onChange={(e) => { const n = [...formQuestions]; n[qi] = { ...n[qi], q: e.target.value }; setFormQuestions(n) }} placeholder="نص السؤال" className="text-sm" />
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => setFormQuestions(formQuestions.filter((_, i) => i !== qi))}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2 mr-6">
                          <button type="button" className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] transition-colors ${q.correct === oi ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'}`}
                            onClick={() => { const n = [...formQuestions]; n[qi] = { ...n[qi], correct: oi }; setFormQuestions(n) }}>{["أ","ب","ت","ث"][oi]}</button>
                          <Input value={opt} onChange={(e) => { const n = [...formQuestions]; const newOpts = [...n[qi].options]; newOpts[oi] = e.target.value; n[qi] = { ...n[qi], options: newOpts }; setFormQuestions(n) }} placeholder={"الخيار " + ["أ","ب","ت","ث"][oi]} className="h-8 text-sm" />
                        </div>
                      ))}
                      <div className="flex gap-2 mr-6">
                        {q.options.length < 6 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { const n = [...formQuestions]; n[qi] = { ...n[qi], options: [...n[qi].options, ''] }; setFormQuestions(n) }}>+ خيار</Button>}
                        <Label className="text-xs mr-auto flex items-center gap-1">الدرجة: <Input type="number" value={q.points} onChange={(e) => { const n = [...formQuestions]; n[qi] = { ...n[qi], points: Number(e.target.value) || 0 }; setFormQuestions(n) }} className="w-14 h-7 text-xs" min={1} /></Label>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setFormQuestions([...formQuestions, { q: '', options: ['', '', '', ''], correct: 0, points: Math.max(1, Math.floor(100 / (formQuestions.length + 1))) }])}><Plus className="h-4 w-4 ml-1" />إضافة سؤال</Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddExam} disabled={submitting || uploading || uploadingAnswerKey}>{submitting || uploading || uploadingAnswerKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </div>
        )}

        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar lg:col-span-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">اختر امتحان لعرض النتائج</p>
              {exams.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">لا توجد امتحانات</p> : exams.map((exam) => (
                <div key={exam.id} className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${selectedExam === exam.id ? 'border-primary bg-primary/5' : 'bg-card'}`}
                  onClick={() => handleExamSelect(exam.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{exam.title}</p>
                      <p className="text-[10px] text-muted-foreground">{exam.grade}</p>
                      <div className="flex gap-1 mt-1">
                        {(exam as any).thumbnail && <Badge variant="outline" className="text-[9px] border-purple-500/40 text-purple-600">صورة</Badge>}
                        {(exam as any).filePath && <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">أسئلة</Badge>}
                        {(exam as any).answerKeyPath && <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600">إجابة</Badge>}
                        {(exam as any).questions && (exam as any).questions !== '' && <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-600">MCQ</Badge>}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleDeleteExam(exam.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-2 space-y-4">
              {!selectedExam ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">اختر امتحان من القائمة لعرض النتائج</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-center px-4 py-2 rounded-lg bg-primary/10"><p className="text-lg font-bold text-primary">{results.length}</p><p className="text-[10px] text-muted-foreground">قدموا</p></div>
                    <div className="text-center px-4 py-2 rounded-lg bg-emerald-500/10"><p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{avgScore}</p><p className="text-[10px] text-muted-foreground">متوسط الدرجات</p></div>
                    <div className="text-center px-4 py-2 rounded-lg bg-red-500/10"><p className="text-lg font-bold text-red-600 dark:text-red-400">{notTaken.length}</p><p className="text-[10px] text-muted-foreground">لم يقدموا بعد</p></div>
                  </div>
                  {results.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">الطلاب الذين قدموا الامتحان</p>
                      <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1">
                        {results.map((r) => (
                          <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border bg-card text-sm">
                            <div><span className="font-medium">{r.student?.name || '—'}</span> <span className="text-[10px] text-muted-foreground" dir="ltr">{r.student?.phone || ''}</span></div>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${r.score >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{r.score}/{r.maxScore}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(r.submittedAt).toLocaleDateString('ar-EG')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {notTaken.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-red-500">لم يقدموا الامتحان بعد</p>
                      <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1">
                        {notTaken.map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 text-sm">
                            <div><span className="font-medium">{s.name}</span> <span className="text-[10px] text-muted-foreground" dir="ltr">{s.phone}</span></div>
                            <UserX className="h-4 w-4 text-red-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ========== GALLERY MANAGER ========== */
function GalleryManager() {
  var [images, setImages] = useState<GalleryImage[]>([])
  var [loading, setLoading] = useState(true)
  var [showForm, setShowForm] = useState(false)
  var [uploading, setUploading] = useState(false)
  var [saving, setSaving] = useState(false)
  var fileRef = useRef<HTMLInputElement>(null)
  var [imgUrl, setImgUrl] = useState('')
  var [imgOrder, setImgOrder] = useState('0')
  var [vidUrl, setVidUrl] = useState('')
  var [vidThumb, setVidThumb] = useState('')
  var [vidOrder, setVidOrder] = useState('0')

  var loadGallery = async function() {
    setLoading(true)
    try {
      var res = await fetch('/api/gallery')
      var data = await res.json()
      setImages(data.images || [])
    } catch { toast.error('خطأ في تحميل المعرض') }
    setLoading(false)
  }

  useEffect(function() { loadGallery() }, [])

  var resetAll = function() {
    setImgUrl(''); setImgOrder('0')
    setVidUrl(''); setVidThumb(''); setVidOrder('0')
    setUploading(false); setSaving(false)
  }

  var handleImgUpload = async function(file: File) {
    setUploading(true)
    try {
      var upData = await chunkedUpload(file, 'gallery')
      await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name,
          filePath: upData.filePath,
          type: 'image',
          sortOrder: parseInt(imgOrder) || 0
        })
      })
      toast.success('تم رفع الصورة بنجاح')
      resetAll(); loadGallery()
    } catch (err: any) { toast.error(err.message || 'خطأ في رفع الصورة') }
    setUploading(false)
  }

  var handleImgLink = async function() {
    if (!imgUrl.trim()) { toast.error('الرجاء إدخال رابط الصورة'); return }
    setSaving(true)
    try {
      var res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'صورة',
          filePath: imgUrl.trim(),
          type: 'image',
          sortOrder: parseInt(imgOrder) || 0
        })
      })
      if (res.ok) {
        toast.success('تم إضافة الصورة بنجاح')
        setImgUrl(''); loadGallery()
      } else { toast.error('خطأ في الإضافة') }
    } catch { toast.error('خطأ في الاتصال') }
    setSaving(false)
  }

  var handleVidAdd = async function() {
    if (!vidUrl.trim()) { toast.error('الرجاء إدخال رابط الفيديو'); return }
    setSaving(true)
    try {
      var body: any = {
        title: 'فيديو',
        videoUrl: vidUrl.trim(),
        type: 'video',
        sortOrder: parseInt(vidOrder) || 0
      }
      if (vidThumb.trim()) { body.filePath = vidThumb.trim() }
      var res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        toast.success('تم إضافة الفيديو بنجاح')
        setVidUrl(''); setVidThumb(''); loadGallery()
      } else { toast.error('خطأ في الإضافة') }
    } catch { toast.error('خطأ في الاتصال') }
    setSaving(false)
  }

  var handleDelete = async function(id: string) {
    try {
      await fetch('/api/gallery/' + id, { method: 'DELETE' })
      toast.success('تم الحذف')
      loadGallery()
    } catch { toast.error('خطأ') }
  }

  var getVideoThumb = function(url: string) {
    var yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/)
    if (yt) return 'https://img.youtube.com/vi/' + yt[1] + '/mqdefault.jpg'
    return ''
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            المعرض | Gallery
          </CardTitle>
          <Button size="sm" onClick={function() { setShowForm(!showForm) }}>
            {showForm ? <X className="h-4 w-4 ml-1" /> : <Plus className="h-4 w-4 ml-1" />}
            {showForm ? 'إغلاق' : 'إضافة'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ===== ADD FORMS ===== */}
        {showForm && (
          <div className="space-y-4 p-4 rounded-xl border bg-muted/30">
            {/* === صورة === */}
            <div className="space-y-3 p-4 rounded-lg border bg-card">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-emerald-600" />
                إضافة صورة
              </h3>

              {/* رفع ملف */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">رفع صورة من الجهاز</Label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={function(e) { var f = e.target.files?.[0]; if (f) handleImgUpload(f); e.target.value = '' }} />
                <Button variant="outline" size="sm" className="border-dashed w-full" onClick={function() { fileRef.current?.click() }} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Upload className="h-4 w-4 ml-2" />}
                  {uploading ? 'جاري الرفع...' : 'اختر صورة للرفع'}
                </Button>
              </div>

              {/* فاصل */}
              <div className="flex items-center gap-3">
                <div className="flex-grow h-px bg-border" />
                <span className="text-[11px] text-muted-foreground">أو</span>
                <div className="flex-grow h-px bg-border" />
              </div>

              {/* لينك صورة + ترتيب */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">رابط الصورة</Label>
                  <Input placeholder="https://example.com/image.jpg" value={imgUrl} onChange={function(e) { setImgUrl(e.target.value) }} dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">الترتيب</Label>
                  <Input type="number" placeholder="0" value={imgOrder} onChange={function(e) { setImgOrder(e.target.value) }} />
                </div>
              </div>

              <Button size="sm" onClick={handleImgLink} disabled={saving || !imgUrl.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Plus className="h-4 w-4 ml-1" />}
                إضافة الصورة بالرابط
              </Button>
            </div>

            {/* === فيديو === */}
            <div className="space-y-3 p-4 rounded-lg border bg-card">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-blue-600" />
                إضافة فيديو
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">رابط الفيديو</Label>
                  <Input placeholder="https://youtube.com/watch?v=..." value={vidUrl} onChange={function(e) { setVidUrl(e.target.value) }} dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">رابط صورة مصغرة (اختياري)</Label>
                  <Input placeholder="https://example.com/thumb.jpg" value={vidThumb} onChange={function(e) { setVidThumb(e.target.value) }} dir="ltr" />
                </div>
              </div>

              <div className="space-y-1 w-full sm:w-1/3">
                <Label className="text-xs text-muted-foreground">الترتيب</Label>
                <Input type="number" placeholder="0" value={vidOrder} onChange={function(e) { setVidOrder(e.target.value) }} />
                <p className="text-[10px] text-muted-foreground">كلما كان الرقم أصغر، كلما ظهر أولاً</p>
              </div>

              <Button size="sm" variant="outline" onClick={handleVidAdd} disabled={saving || !vidUrl.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Plus className="h-4 w-4 ml-1" />}
                إضافة الفيديو
              </Button>
            </div>
          </div>
        )}

        {/* ===== GALLERY GRID ===== */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد صور أو فيديوهات بعد. اضغط &quot;إضافة&quot; للبدء!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar">
            {images.map(function(img) {
              var isVideo = img.type === 'video'
              var thumb = isVideo ? (getVideoThumb(img.videoUrl) || img.filePath || '') : img.filePath
              var src = isVideo ? thumb : img.filePath
              return (
                <div key={img.id} className="relative group rounded-lg overflow-hidden border bg-card aspect-square">
                  {src ? (
                    <Image src={src} alt={img.title} fill className="object-cover" sizes="200px" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <PlayCircle className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                        <PlayCircle className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant="secondary" className="bg-black/50 text-white border-0 text-[10px] backdrop-blur-sm">
                      {isVideo ? 'فيديو' : 'صورة'}
                    </Badge>
                  </div>
                  <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant="secondary" className="bg-black/50 text-white border-0 text-[10px] backdrop-blur-sm">
                      ترتيب: {img.sortOrder}
                    </Badge>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={function() { handleDelete(img.id) }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ========== MY STUDENTS PANEL (طلابي) ========== */
interface StudentAnalytics {
  id: string; name: string; phone: string; grade: string
  loginCount: number; lastLogin: string | null; createdAt: string
  watchedVideos: number; completedVideos: number; totalVideos: number
  avgWatchPercent: number
  examsTaken: number; examsPassed: number; totalExams: number
  avgExamScore: number; hwTaken: number; avgHwScore: number; activityScore: number
}

function MyStudentsPanel() {
  const [grade, setGrade] = useState('')
  const [students, setStudents] = useState<StudentAnalytics[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentAnalytics | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadData = async () => {
    if (!grade) { setStudents([]); setSummary(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/students/analytics?grade=${encodeURIComponent(grade)}`)
      const data = await res.json()
      setStudents(data.students || [])
      setSummary(data.gradeSummary)
    } catch { toast.error('خطأ في تحميل البيانات') }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [grade])

  const loadDetail = async (studentId: string) => {
    setSelectedStudent(students.find(s => s.id === studentId) || null)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/students/${studentId}/progress`)
      const data = await res.json()
      setDetail(data)
    } catch { toast.error('خطأ في تحميل التفاصيل') }
    setLoadingDetail(false)
  }

  const getActivityColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600 dark:text-emerald-400'
    if (score >= 40) return 'text-amber-600 dark:text-amber-400'
    return 'text-rose-400'
  }

  const getActivityBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/10'
    if (score >= 40) return 'bg-amber-500/10'
    return 'bg-red-500/10'
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />طلابي | My Students</CardTitle>
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm min-w-[200px]">
              <option value="">اختر الصف لعرض التحليلات</option>
              {GRADES_EN.map((g) => <option key={g.ar} value={g.ar}>{g.ar} {g.en}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {!grade ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">اختر صفًا دراسيًا لعرض تحليلات الطلاب</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">لا يوجد طلاب مفعلون في هذا الصف</p>
            </div>
          ) : (
            <>
              {/* Grade Summary Cards */}
              {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="text-center p-3 rounded-lg bg-primary/10"><p className="text-xl font-bold text-primary">{summary.totalStudents}</p><p className="text-[10px] text-muted-foreground">طلاب مفعلون</p></div>
                  <div className="text-center p-3 rounded-lg bg-emerald-500/10"><p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{summary.avgWatchPercent}%</p><p className="text-[10px] text-muted-foreground">متوسط المشاهدة</p></div>
                  <div className="text-center p-3 rounded-lg bg-amber-500/10"><p className="text-xl font-bold text-amber-600 dark:text-amber-400">{summary.avgExamScore}</p><p className="text-[10px] text-muted-foreground">متوسط الدرجات</p></div>
                  <div className="text-center p-3 rounded-lg bg-purple-500/10"><p className="text-xl font-bold text-purple-600 dark:text-purple-400">{summary.avgActivity}%</p><p className="text-[10px] text-muted-foreground">متوسط النشاط</p></div>
                </div>
              )}

              {/* Student Analytics Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground">
                    <th className="text-right py-2 px-2 font-medium">الطالب</th>
                    <th className="text-center py-2 px-1 font-medium">المشاهدة</th>
                    <th className="text-center py-2 px-1 font-medium">الامتحانات</th>
                    <th className="text-center py-2 px-1 font-medium">الدرجة</th>
                    <th className="text-center py-2 px-1 font-medium">الواجبات</th>
                    <th className="text-center py-2 px-1 font-medium">النشاط</th>
                    <th className="text-center py-2 px-1 font-medium">آخر دخول</th>
                    <th className="text-center py-2 px-1 font-medium">تفاصيل</th>
                  </tr></thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => loadDetail(s.id)}>
                        <td className="py-2.5 px-2">
                          <p className="font-medium text-xs truncate max-w-[150px]">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground" dir="ltr">{s.phone}</p>
                        </td>
                        <td className="text-center py-2 px-1">
                          <div className={`text-xs font-bold ${s.avgWatchPercent >= 70 ? 'text-emerald-600' : s.avgWatchPercent >= 40 ? 'text-amber-600' : 'text-rose-400'}`}>{s.avgWatchPercent}%</div>
                          <p className="text-[9px] text-muted-foreground">{s.watchedVideos}/{s.totalVideos}</p>
                        </td>
                        <td className="text-center py-2 px-1">
                          <div className="text-xs font-medium">{s.examsTaken}/{s.totalExams}</div>
                          <p className={`text-[9px] ${s.examsPassed === s.examsTaken && s.examsTaken > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{s.examsPassed} شاطر</p>
                        </td>
                        <td className="text-center py-2 px-1">
                          <span className={`text-xs font-bold ${s.avgExamScore >= 50 ? 'text-teal-600' : s.avgExamScore > 0 ? 'text-rose-400' : 'text-muted-foreground'}`}>{s.avgExamScore || '—'}</span>
                        </td>
                        <td className="text-center py-2 px-1">
                          <div className="text-xs font-medium">{(s as any).hwTaken || 0}</div>
                          <p className="text-[9px] text-muted-foreground">{(s as any).avgHwScore || '—'}%</p>
                        </td>
                        <td className="text-center py-2 px-1">
                          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold ${getActivityColor(s.activityScore)} ${getActivityBg(s.activityScore)}`}>{s.activityScore}</div>
                        </td>
                        <td className="text-center py-2 px-1">
                          <span className="text-[10px] text-muted-foreground">{s.lastLogin ? new Date(s.lastLogin).toLocaleDateString('ar-EG') : 'لم يسجل'}</span>
                        </td>
                        <td className="text-center py-2 px-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); loadDetail(s.id) }}><Eye className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Student Detail Panel */}
      {selectedStudent && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">تحليلات: {selectedStudent.name}</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedStudent(null); setDetail(null) }}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDetail ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : detail ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="text-center p-3 rounded-lg border"><p className="text-lg font-bold text-primary">{detail.summary?.totalVideosWatched || 0}</p><p className="text-[10px] text-muted-foreground">فيديوهات شاهدها</p></div>
                <div className="text-center p-3 rounded-lg border"><p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{detail.summary?.avgWatchPercent || 0}%</p><p className="text-[10px] text-muted-foreground">متوسط المشاهدة</p></div>
                <div className="text-center p-3 rounded-lg border"><p className="text-lg font-bold text-amber-600 dark:text-amber-400">{detail.summary?.avgExamScore || 0}</p><p className="text-[10px] text-muted-foreground">متوسط الدرجات</p></div>
                <div className="text-center p-3 rounded-lg border"><p className="text-lg font-bold text-violet-500 dark:text-violet-400">{detail.summary?.examsPassed || 0}/{detail.summary?.totalExamsTaken || 0}</p><p className="text-[10px] text-muted-foreground">شاطر/قدم</p></div>
                <div className="text-center p-3 rounded-lg border"><p className="text-lg font-bold text-sky-600 dark:text-sky-400">{detail.summary?.avgHwScore || 0}%</p><p className="text-[10px] text-muted-foreground">متوسط الواجبات</p></div>

                {/* Video Progress Detail */}
                {detail.videoProgress && detail.videoProgress.length > 0 && (
                  <div className="sm:col-span-2">
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><Video className="h-3.5 w-3.5" />تقدم الفيديوهات</h4>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                      {detail.videoProgress.slice(0, 10).map((vp: any) => (
                        <div key={vp.id} className="flex items-center gap-2 p-1.5 rounded border bg-card">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium truncate">{vp.videoTitle}</p>
                          </div>
                          <div className="shrink-0" style={{ minWidth: '50px' }}>
                            <span className={`text-[11px] font-bold ${vp.percent >= 90 ? 'text-emerald-600' : vp.percent >= 50 ? 'text-amber-600' : 'text-rose-400'}`}>{vp.percent}%</span>
                          </div>
                          <div className="h-1.5 w-16 bg-muted rounded-full shrink-0"><div className={`h-full rounded-full ${vp.percent >= 90 ? 'bg-emerald-500' : vp.percent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${vp.percent}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exam Results Detail */}
                {detail.examResults && detail.examResults.length > 0 && (
                  <div className="sm:col-span-2">
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-amber-500" />نتائج الامتحانات</h4>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                      {detail.examResults.map((er: any) => (
                        <div key={er.id} className="flex items-center justify-between p-1.5 rounded border bg-card">
                          <p className="text-[11px] font-medium truncate max-w-[200px]">{er.examTitle}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${er.passed ? 'text-emerald-600' : 'text-rose-400'}`}>{er.score}/{er.maxScore}</span>
                            <Badge variant={er.passed ? 'default' : 'destructive'} className="text-[9px] h-5">{er.passed ? 'شاطر' : 'عايز مراجعة على الدروس'}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Homework Results Detail */}
                {detail.homeworkResults && detail.homeworkResults.length > 0 && (
                  <div className="sm:col-span-2">
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5 text-sky-500" />نتائج الواجبات</h4>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                      {detail.homeworkResults.map((hr: any) => (
                        <div key={hr.id} className="flex items-center justify-between p-1.5 rounded-lg border bg-card">
                          <p className="text-[11px] font-medium truncate max-w-[200px]">{hr.homeworkTitle}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${hr.passed ? 'text-teal-600' : 'text-amber-600'}`}>{hr.score}/{hr.maxScore}</span>
                            <Badge variant={hr.passed ? 'default' : 'secondary'} className="text-[9px] h-5">{hr.resultMessage}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6 text-sm">مفيش بيانات</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ========== CONTENT MANAGER (for Homework & Announcements) ========== */
interface CMProps<T extends { id: string; grade: string; createdAt: string }> {
  title: string; apiPath: string; itemName: string
  fields: Record<string, { label: string; type: 'text' | 'textarea'; placeholder?: string }>
  renderTitle: (item: T) => string; renderSubtitle: (item: T) => string
  supportFileUpload?: boolean; fileCategory?: string; acceptedTypes?: string
  supportAnswerKey?: boolean; supportThumbnail?: boolean; supportMCQ?: boolean
  onRefresh: () => void
}

function ContentManager<T extends { id: string; grade: string; createdAt: string }>({ title, apiPath, itemName, fields, renderTitle, renderSubtitle, supportFileUpload, fileCategory, acceptedTypes, supportAnswerKey, supportThumbnail, supportMCQ, onRefresh }: CMProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formGrade, setFormGrade] = useState('')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [mcqQuestions, setMcqQuestions] = useState<Array<{ question: string; options: string[]; correct: number }>>([])
  const [formFile, setFormFile] = useState<File | null>(null)
  const [formFilePath, setFormFilePath] = useState('')
  const [formFileUrl, setFormFileUrl] = useState('')
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null)
  const [answerKeyPath, setAnswerKeyPath] = useState('')
  const [answerKeyUrl, setAnswerKeyUrl] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [aiExtracting, setAiExtracting] = useState(false)
  const [filterGrade, setFilterGrade] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const answerKeyRef = useRef<HTMLInputElement>(null)
  const thumbnailRef = useRef<HTMLInputElement>(null)

  const loadItems = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '100' })
      if (filterGrade) params.set('grade', filterGrade)
      const res = await fetch(`${apiPath}?${params}`)
      if (!res.ok) {
        try { const errData = await res.json(); toast.error('خطأ في تحميل: ' + (errData.error || ''), { description: apiPath, duration: 8000 }) } catch { toast.error('خطأ في السيرفر', { description: apiPath, duration: 8000 }) }
      } else {
        const data = await res.json()
        setItems(data[itemName] || [])
      }
    } catch (err: any) { toast.error('خطأ في تحميل البيانات: ' + (err.message || ''), { description: apiPath, duration: 6000 }) }
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [apiPath, itemName, filterGrade])

  const handleFileUpload = async (localPath: { val: string }, localType: { val: string }): Promise<boolean> => {
    // URL fallback: if URL is provided, use it directly instead of uploading
    if (formFileUrl.trim()) {
      localPath.val = formFileUrl.trim()
      localType.val = ''
      setFormFilePath(localPath.val)
      return true
    }
    if (!formFile || !fileCategory) return true
    setUploading(true)
    setUploadMsg('جاري رفع نموذج الأسئلة...')
    try {
      const data = await chunkedUpload(formFile, fileCategory, undefined, (msg) => setUploadMsg(msg))
      localPath.val = data.filePath
      localType.val = data.fileType
      setFormFilePath(data.filePath)
      return true
    } catch (err: any) {
      toast.error(err.message || 'خطأ في رفع الملف')
      return false
    } finally {
      setUploading(false)
      setUploadMsg('')
    }
  }

  const handleAnswerKeyUpload = async (localPath: { val: string }, localType: { val: string }): Promise<boolean> => {
    // URL fallback
    if (answerKeyUrl.trim()) {
      localPath.val = answerKeyUrl.trim()
      localType.val = ''
      setAnswerKeyPath(localPath.val)
      return true
    }
    if (!answerKeyFile || !fileCategory) return true
    setUploading(true)
    setUploadMsg('جاري رفع نموذج الإجابة...')
    try {
      const data = await chunkedUpload(answerKeyFile, fileCategory, undefined, (msg) => setUploadMsg(msg))
      localPath.val = data.filePath
      localType.val = data.fileType
      setAnswerKeyPath(data.filePath)
      return true
    } catch (err: any) {
      toast.error(err.message || 'خطأ في رفع نموذج الإجابة')
      return false
    } finally {
      setUploading(false)
      setUploadMsg('')
    }
  }

  const handleThumbnailUpload = async (localPath: { val: string }): Promise<boolean> => {
    // URL fallback
    if (thumbnailUrl.trim()) {
      localPath.val = thumbnailUrl.trim()
      setThumbnailPath(localPath.val)
      return true
    }
    if (!thumbnailFile || !fileCategory) return true
    setUploading(true)
    setUploadMsg('جاري رفع الصورة المصغرة...')
    try {
      const data = await chunkedUpload(thumbnailFile, fileCategory, undefined, (msg) => setUploadMsg(msg))
      localPath.val = data.filePath
      setThumbnailPath(data.filePath)
      return true
    } catch (err: any) {
      toast.error(err.message || 'خطأ في رفع الصورة المصغرة')
      return false
    } finally {
      setUploading(false)
      setUploadMsg('')
    }
  }

  const handleAIExtract = async () => {
    if (aiExtracting) return
    setAiExtracting(true)
    setUploadMsg('جاري استخراج الأسئلة بالذكاء الاصطناعي...')
    try {
      var fd = new FormData()
      if (formFile) { fd.append('file', formFile) }
      else if (formFileUrl.trim()) { fd.append('fileUrl', formFileUrl.trim()) }
      else { toast.error('ارفع ملف الأسئلة أولاً أو حط رابط'); setAiExtracting(false); setUploadMsg(''); return }
      var ctrl = new AbortController()
      var tmr = setTimeout(function() { ctrl.abort() }, 60000)
      var res = await fetch('/api/ai/extract-questions', { method: 'POST', body: fd, signal: ctrl.signal })
      clearTimeout(tmr)
      var data = await res.json()
      if (res.ok && data.questions && data.questions.length > 0) {
        var extracted = data.questions.map(function(q: any) { return { question: q.question || '', options: (q.options || ['','','','']).slice(0, 4), correct: q.correct || 0 } })
        setMcqQuestions(extracted)
        toast.success('تم استخراج ' + extracted.length + ' سؤال بنجاح!')
      } else { toast.error(data.error || 'لم يتم استخراج أسئلة') }
    } catch (err: any) {
      if (err && err.name === 'AbortError') { toast.error('انتهت مهلة الاستخراج') }
      else { toast.error('خطأ: ' + (err.message || '')) }
    }
    setAiExtracting(false)
    setUploadMsg('')
  }

  const handleSubmit = async () => {
    const titleVal = formValues['title']
    if (!titleVal?.trim()) { toast.error('أدخل العنوان'); return }
    if (!formGrade) { toast.error('اختر الصف'); return }
    setSubmitting(true)
    try {
      // Use local refs to avoid React state batching issues
      const filePathRef = { val: formFilePath || '' }
      const fileTypeRef = { val: formFile?.type || '' }
      const answerKeyPathRef = { val: answerKeyPath || '' }
      const answerKeyTypeRef = { val: '' }
      const thumbnailPathRef = { val: thumbnailPath || '' }

      // Upload question paper
      if (supportFileUpload && !filePathRef.val && (formFile || formFileUrl.trim())) {
        const ok = await handleFileUpload(filePathRef, fileTypeRef)
        if (!ok) { setSubmitting(false); return }
      }
      // Upload answer key
      if (supportAnswerKey && !answerKeyPathRef.val && (answerKeyFile || answerKeyUrl.trim())) {
        const ok = await handleAnswerKeyUpload(answerKeyPathRef, answerKeyTypeRef)
        if (!ok) { setSubmitting(false); return }
      }
      // Upload thumbnail
      if (supportThumbnail && !thumbnailPathRef.val && (thumbnailFile || thumbnailUrl.trim())) {
        const ok = await handleThumbnailUpload(thumbnailPathRef)
        if (!ok) { setSubmitting(false); return }
      }
      const body: Record<string, string> = { ...formValues, grade: formGrade }
      if (filePathRef.val) { body.filePath = filePathRef.val; body.fileType = fileTypeRef.val }
      if (answerKeyPathRef.val) { body.answerKeyPath = answerKeyPathRef.val; body.answerKeyType = answerKeyTypeRef.val }
      if (thumbnailPathRef.val) { body.thumbnail = thumbnailPathRef.val }
      if (supportMCQ && mcqQuestions.length > 0) { body.questions = JSON.stringify(mcqQuestions) }
      const res = await fetch(apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        toast.success('تم الإضافة بنجاح'); setShowForm(false); setFormValues({}); setFormGrade(''); setFormFile(null); setFormFilePath(''); setFormFileUrl(''); setAnswerKeyFile(null); setAnswerKeyPath(''); setAnswerKeyUrl(''); setThumbnailFile(null); setThumbnailPath(''); setThumbnailUrl(''); setMcqQuestions([]); loadItems(false); onRefresh()
      } else { try { const d = await res.json(); toast.error(d.error || 'خطأ', { duration: 8000 }) } catch { toast.error('خطأ في السيرفر - حاول تاني', { duration: 8000 }) } }
    } catch (err: any) { toast.error('خطأ في الاتصال: ' + (err.message || ''), { duration: 8000 }) }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    try { await fetch(`${apiPath}/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); loadItems(false); onRefresh() } catch { toast.error('خطأ') }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex gap-2 items-center flex-wrap">
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">كل الصفوف</option>
              {GRADES_EN.map((g) => <option key={g.ar} value={g.ar}>{g.ar} {g.en}</option>)}
            </select>
            <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 ml-1" />إضافة</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <h4 className="font-semibold text-sm">إضافة جديد</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">الصف الدراسي</Label>
              <select value={formGrade} onChange={(e) => setFormGrade(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">اختر الصف</option>{GRADES_EN.map((g) => <option key={g.ar} value={g.ar}>{g.ar} {g.en}</option>)}
              </select>
            </div>
            {Object.entries(fields).map(([key, field]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{field.label}</Label>
                {field.type === 'textarea' ? (
                  <Textarea placeholder={field.placeholder} value={formValues[key] || ''} onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })} rows={4} />
                ) : (
                  <Input placeholder={field.placeholder} value={formValues[key] || ''} onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })} dir={key === 'url' ? 'ltr' : 'rtl'} />
                )}
              </div>
            ))}
            {supportFileUpload && (
              <div className="space-y-1.5">
                <Label className="text-xs">نموذج الأسئلة (رفع ملف أو رابط)</Label>
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept={acceptedTypes} className="hidden" onChange={(e) => { setFormFile(e.target.files?.[0] || null); setFormFilePath(''); setFormFileUrl('') }} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 ml-1" />{formFile ? formFile.name : 'رفع ملف'}</Button>
                  {formFile && <span className="text-xs text-muted-foreground">{(formFile.size / 1024 / 1024).toFixed(1)} MB</span>}
                  {uploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground shrink-0">أو رابط:</span>
                  <Input placeholder="https://..." value={formFileUrl} onChange={(e) => { setFormFileUrl(e.target.value); if (e.target.value.trim()) { setFormFile(null); setFormFilePath('') } }} dir="ltr" className="h-8 text-xs" />
                </div>
              </div>
            )}
            {supportAnswerKey && (
              <div className="space-y-1.5">
                <Label className="text-xs">نموذج الإجابة (رفع ملف أو رابط)</Label>
                <div className="flex items-center gap-2">
                  <input ref={answerKeyRef} type="file" accept={acceptedTypes} className="hidden" onChange={(e) => { setAnswerKeyFile(e.target.files?.[0] || null); setAnswerKeyPath(''); setAnswerKeyUrl('') }} />
                  <Button type="button" variant="outline" size="sm" onClick={() => answerKeyRef.current?.click()}><FileDown className="h-4 w-4 ml-1" />{answerKeyFile ? answerKeyFile.name : 'رفع ملف'}</Button>
                  {answerKeyFile && <span className="text-xs text-muted-foreground">{(answerKeyFile.size / 1024 / 1024).toFixed(1)} MB</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground shrink-0">أو رابط:</span>
                  <Input placeholder="https://..." value={answerKeyUrl} onChange={(e) => { setAnswerKeyUrl(e.target.value); if (e.target.value.trim()) { setAnswerKeyFile(null); setAnswerKeyPath('') } }} dir="ltr" className="h-8 text-xs" />
                </div>
              </div>
            )}
            {supportThumbnail && (
              <div className="space-y-1.5">
                <Label className="text-xs">صورة مصغرة (اختياري - رفع أو رابط)</Label>
                <div className="flex items-center gap-3">
                  <input ref={thumbnailRef} type="file" accept="image/*" className="hidden" onChange={(e) => { setThumbnailFile(e.target.files?.[0] || null); setThumbnailPath(''); setThumbnailUrl('') }} />
                  <Button type="button" variant="outline" size="sm" onClick={() => thumbnailRef.current?.click()}><PictureInPicture2 className="h-4 w-4 ml-1" />{thumbnailFile ? thumbnailFile.name : 'رفع صورة'}</Button>
                  {thumbnailFile && <span className="text-xs text-muted-foreground">{(thumbnailFile.size / 1024).toFixed(0)} KB</span>}
                  {thumbnailPath && <div className="w-12 h-8 rounded border overflow-hidden relative"><Image src={thumbnailPath} alt="thumb" fill className="object-cover" sizes="48px" unoptimized /></div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground shrink-0">أو رابط:</span>
                  <Input placeholder="https://..." value={thumbnailUrl} onChange={(e) => { setThumbnailUrl(e.target.value); if (e.target.value.trim()) { setThumbnailFile(null); setThumbnailPath('') } }} dir="ltr" className="h-8 text-xs" />
                </div>
              </div>
            )}
            {supportMCQ && (
              <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-primary">أسئلة اختيار من متعدد (اختياري)</Label>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={function() {
                      setMcqQuestions([...mcqQuestions, { question: '', options: ['', '', '', ''], correct: 0 }])
                    }}><Plus className="h-3 w-3 ml-1" />إضافة سؤال</Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-purple-500/50 text-purple-600 hover:bg-purple-500/10" onClick={handleAIExtract} disabled={aiExtracting || (!formFile && !formFileUrl.trim())}>
                      {aiExtracting ? <Loader2 className="h-3 w-3 ml-1 animate-spin" /> : <Sparkles className="h-3 w-3 ml-1" />}
                      استخراج بالذكاء الاصطناعي
                    </Button>
                  </div>
                </div>
                {mcqQuestions.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-2">اضغط "إضافة سؤال" لإضافة أسئلة متعددة</p>}
                {mcqQuestions.map(function(q, qi) {
                  return (
                    <div key={qi} className="space-y-2 p-3 rounded-lg border bg-background">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">سؤال {qi + 1}</span>
                        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={function() { setMcqQuestions(mcqQuestions.filter(function(_, i) { return i !== qi })) }}><X className="h-3 w-3" /></Button>
                      </div>
                      <Input placeholder="اكتب السؤال هنا..." value={q.question} onChange={function(e) { var updated = [...mcqQuestions]; updated[qi] = { ...updated[qi], question: e.target.value }; setMcqQuestions(updated) }} className="text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map(function(opt, oi) {
                          return (
                            <div key={oi} className="flex items-center gap-1.5">
                              <input type="radio" name={"q" + qi} checked={q.correct === oi} onChange={function() { var updated = [...mcqQuestions]; updated[qi] = { ...updated[qi], correct: oi }; setMcqQuestions(updated) }} className="accent-primary" />
                              <Input placeholder={"اختيار " + (oi + 1)} value={opt} onChange={function(e) { var updated = [...mcqQuestions]; var newOpts = [...updated[qi].options]; newOpts[oi] = e.target.value; updated[qi] = { ...updated[qi], options: newOpts }; setMcqQuestions(updated) }} className="h-8 text-xs" />
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground">اختر الإجابة الصحيحة بجانب الاختيار</p>
                    </div>
                  )
                })}
              </div>
            )}
            {uploadMsg && <p className="text-xs text-primary animate-pulse">{uploadMsg}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={submitting || uploading}>{submitting || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}</Button>
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setFormValues({}); setFormFile(null); setFormFilePath(''); setFormFileUrl(''); setAnswerKeyFile(null); setAnswerKeyPath(''); setAnswerKeyUrl(''); setThumbnailFile(null); setThumbnailPath(''); setThumbnailUrl(''); setMcqQuestions([]); setUploadMsg('') }}>إلغاء</Button>
            </div>
          </div>
        )}
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">لا توجد عناصر</p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
            {items.map((item: any) => (
              <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border bg-card">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="font-semibold text-sm">{renderTitle(item)}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-md">{renderSubtitle(item)}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{item.grade}</Badge>
                    {(item as any).thumbnail && <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-600">صورة</Badge>}
                    {item.filePath && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">أسئلة</Badge>}
                    {item.answerKeyPath && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">إجابة</Badge>}
                    {(item as any).questions && <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">أسئلة</Badge>}
                    <span className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ========== AI EXTRACTION PANEL ========== */
   /* ============================================================
   REPLACE the entire AIExtractionPanel function in AdminDashboard.tsx
   (find "function AIExtractionPanel" and replace until its closing "}")
   with the code below.
   ============================================================ */

function AIExtractionPanel({ onRefresh }: { onRefresh: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [extractType, setExtractType] = useState<'exam' | 'homework'>('exam')
  const [grade, setGrade] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [extractedQuestions, setExtractedQuestions] = useState<Array<{ question: string; options: string[]; correct: number }>>([])
  const [statusMsg, setStatusMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  var resetAll = function() {
    setStep(1); setExtractType('exam'); setGrade(''); setTitle('')
    setFile(null); setFileUrl(''); setYoutubeUrl(''); setNumQuestions(10)
    setExtractedQuestions([]); setStatusMsg('')
  }

  var isYouTube = function(url) {
    if (!url) return false
    return /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|))([\w-]{11})/.test(url)
  }

  var canProceedStep1 = extractType && grade.trim() && title.trim()
  var canExtract = file || fileUrl.trim() || (youtubeUrl.trim() && isYouTube(youtubeUrl))
  var isYTMode = youtubeUrl.trim() && isYouTube(youtubeUrl)

  var renderStep1 = function() {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <Sparkles className="h-10 w-10 text-purple-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold">استخراج الأسئلة بالذكاء الاصطناعي</h3>
          <p className="text-sm text-muted-foreground mt-1">ارفع ملف أو حط رابط يوتيوب واستخرج الأسئلة تلقائي</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={function() { setExtractType('exam') }} className={"p-4 rounded-xl border-2 text-center transition-all " + (extractType === 'exam' ? 'border-primary bg-primary/5 shadow-md' : 'border-muted hover:border-primary/30')}>
            <FileText className={"h-8 w-8 mx-auto mb-2 " + (extractType === 'exam' ? 'text-primary' : 'text-muted-foreground')} />
            <p className={"font-bold text-sm " + (extractType === 'exam' ? 'text-primary' : '')}>امتحان</p>
          </button>
          <button type="button" onClick={function() { setExtractType('homework') }} className={"p-4 rounded-xl border-2 text-center transition-all " + (extractType === 'homework' ? 'border-primary bg-primary/5 shadow-md' : 'border-muted hover:border-primary/30')}>
            <ClipboardList className={"h-8 w-8 mx-auto mb-2 " + (extractType === 'homework' ? 'text-primary' : 'text-muted-foreground')} />
            <p className={"font-bold text-sm " + (extractType === 'homework' ? 'text-primary' : '')}>واجب</p>
          </button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">الصف *</Label>
          <select value={grade} onChange={function(e) { setGrade(e.target.value) }} className="w-full h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
            <option value="">اختار الصف</option>
            {GRADES.map(function(g) { return <option key={g} value={g}>{g}</option> })}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">العنوان *</Label>
          <Input value={title} onChange={function(e) { setTitle(e.target.value) }} placeholder={extractType === 'exam' ? 'مثلاً: امتحان الوحدة الأولى' : 'مثلاً: واجب الحضارات'} />
        </div>
        <Button className="w-full" onClick={function() { if (canProceedStep1) setStep(2) }} disabled={!canProceedStep1}>التالي - رفع الملف</Button>
      </div>
    )
  }

  var handleExtract = async function() {
    if (!canExtract || extracting) return
    setExtracting(true)

    // YouTube mode -> calls /api/ai-extract-youtube
    if (isYTMode) {
      setStatusMsg('بيحلل الفيديو بالذكاء الاصطناعي... ممكن ياخد 1-2 دقيقة')
      try {
        var ctrl = new AbortController()
        var tmr = setTimeout(function() { ctrl.abort() }, 180000)
        var res = await fetch('/api/ai-extract-youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeUrl: youtubeUrl.trim(), numQuestions: numQuestions, type: extractType }),
          signal: ctrl.signal
        })
        clearTimeout(tmr)
        var data = await res.json()
        if (res.ok && data.extracted && data.extracted.questions && data.extracted.questions.length > 0) {
          var extracted = data.extracted.questions.map(function(q: any) {
            return { question: q.question || '', options: (q.options || ['-','-','-','-']).slice(0, 4), correct: q.correct || 0 }
          })
          setExtractedQuestions(extracted)
          setStatusMsg('')
          setStep(3)
          toast.success('تم استخراج ' + extracted.length + ' سؤال من الفيديو!')
        } else {
          toast.error(data.error || 'مفيش أسئلة اتعملت استخراج')
          setStatusMsg('')
        }
      } catch (err: any) {
        if (err && err.name === 'AbortError') { toast.error('انتهى الوقت - حاول تاني') }
        else { toast.error('خطأ: ' + (err.message || '')) }
        setStatusMsg('')
      }
      setExtracting(false)
      return
    }

    // File / URL mode -> calls /api/ai-extract
    setStatusMsg('بيستخرج الأسئلة بالذكاء الاصطناعي... استنى شوية')
    try {
      var fd = new FormData()
      if (file) { fd.append('file', file) }
      else if (fileUrl.trim()) { fd.append('fileUrl', fileUrl.trim()) }
      fd.append('type', extractType)
      fd.append('grade', grade)
      var ctrl = new AbortController()
      var tmr = setTimeout(function() { ctrl.abort() }, 120000)
      var res = await fetch('/api/ai-extract', { method: 'POST', body: fd, signal: ctrl.signal })
      clearTimeout(tmr)
      var data = await res.json()
      if (res.ok && data.extracted && data.extracted.questions && data.extracted.questions.length > 0) {
        var extracted = data.extracted.questions.map(function(q: any) {
          return { question: q.question || '', options: (q.options || ['-','-','-','-']).slice(0, 4), correct: q.correct || 0 }
        })
        setExtractedQuestions(extracted)
        setStatusMsg('')
        setStep(3)
        toast.success('تم استخراج ' + extracted.length + ' سؤال!')
      } else {
        toast.error(data.error || 'مفيش أسئلة اتعملت استخراج')
        setStatusMsg('')
      }
    } catch (err: any) {
      if (err && err.name === 'AbortError') { toast.error('انتهى الوقت - حاول تاني') }
      else { toast.error('خطأ: ' + (err.message || '')) }
      setStatusMsg('')
    }
    setExtracting(false)
  }

  var renderStep2 = function() {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button type="button" onClick={function() { setStep(1) }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><X className="h-4 w-4" /> رجوع</button>
          <div className="flex items-center gap-2 flex-1">
            <Badge variant="outline" className={"text-xs " + (extractType === 'exam' ? 'border-blue-500/50 text-blue-600' : 'border-emerald-500/50 text-emerald-600')}>{extractType === 'exam' ? 'امتحان' : 'واجب'}</Badge>
            <span className="text-sm font-medium truncate">{title}</span>
            <Badge variant="secondary" className="text-xs">{grade}</Badge>
          </div>
        </div>

        <div className="p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 space-y-3">
          <div className="text-center">
            <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">ارفع ملف الامتحان/الواجب أو صورة</p>
            <p className="text-[10px] text-muted-foreground">PDF، صورة، أو أي ملف فيه أسئلة</p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={function(e) { setFile(e.target.files?.[0] || null); setFileUrl('') }} />
            <Button type="button" variant="outline" onClick={function() { fileRef.current?.click() }} className="flex-1"><Upload className="h-4 w-4 ml-2" />{file ? file.name : 'اختار ملف من الجهاز'}</Button>
          </div>
          {file && <p className="text-xs text-muted-foreground text-center">{(file.size / 1024 / 1024).toFixed(1)} MB</p>}
          <div className="flex items-center gap-3"><div className="flex-grow h-px bg-border" /><span className="text-[11px] text-muted-foreground">أو</span><div className="flex-grow h-px bg-border" /></div>
          <div className="space-y-1.5">
            <Label className="text-xs">أو حط رابط الملف</Label>
            <Input placeholder="https://example.com/exam.pdf" value={fileUrl} onChange={function(e) { setFileUrl(e.target.value); if (e.target.value.trim()) { setFile(null) } }} dir="ltr" />
          </div>
        </div>

        <div className="flex items-center gap-3"><div className="flex-grow h-px bg-border" /><span className="text-[11px] text-muted-foreground">أو استخرج من فيديو</span><div className="flex-grow h-px bg-border" /></div>
        <div className={"p-4 rounded-xl border-2 space-y-3 transition-all " + (isYTMode ? 'border-red-500/50 bg-red-500/5' : 'border-dashed border-muted-foreground/30 bg-muted/30')}>
          <div className="flex items-center gap-2">
            <div className={"w-8 h-8 rounded-lg flex items-center justify-center " + (isYTMode ? 'bg-red-500/10' : 'bg-muted')}>
              <svg className={"h-5 w-5 " + (isYTMode ? 'text-red-500' : 'text-muted-foreground')} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className={"text-sm font-medium " + (isYTMode ? 'text-red-500' : '')}>استخراج من فيديو يوتيوب</p>
              <p className="text-[10px] text-muted-foreground">الذكاء الاصطناعي هيشوف الفيديو ويطلع أسئلة</p>
            </div>
          </div>
          <Input
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={function(e) { setYoutubeUrl(e.target.value); if (e.target.value.trim() && isYouTube(e.target.value)) { setFile(null); setFileUrl('') } }}
            dir="ltr"
            className={"text-sm " + (isYTMode ? 'border-red-500/50 focus-visible:ring-red-500/30' : '')}
          />
          {isYTMode && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">عدد الأسئلة</Label>
                <div className="flex gap-2">
                  {[5, 10, 15, 20, 30].map(function(n) {
                    return (
                      <button key={n} type="button" onClick={function() { setNumQuestions(n) }} className={"flex-1 py-2 rounded-lg text-sm font-medium transition-all border " + (numQuestions === n ? 'border-red-500 bg-red-500/10 text-red-600' : 'border-muted hover:border-red-500/30')}>{n}</button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {statusMsg && <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400"><Loader2 className="h-4 w-4 animate-spin" /><p className="text-sm">{statusMsg}</p></div>}
        <Button className="w-full" size="lg" onClick={handleExtract} disabled={!canExtract || extracting}>
          {extracting ? <Loader2 className="h-5 w-5 ml-2 animate-spin" /> : isYTMode ? <PlayCircle className="h-5 w-5 ml-2" /> : <Sparkles className="h-5 w-5 ml-2" />}
          {extracting ? (isYTMode ? 'بيحلل الفيديو...' : 'بيستخرج...') : isYTMode ? 'استخراج أسئلة من الفيديو' : 'استخراج الأسئلة'}
        </Button>
      </div>
    )
  }

  var updateQuestion = function(qi: number, field: string, value: any) {
    var updated = extractedQuestions.map(function(q, i) {
      if (i !== qi) return q
      if (field === 'question') return Object.assign({}, q, { question: value })
      if (field === 'correct') return Object.assign({}, q, { correct: value })
      if (field.startsWith('option_')) {
        var oi = parseInt(field.split('_')[1])
        var newOpts = q.options.slice(); newOpts[oi] = value
        return Object.assign({}, q, { options: newOpts })
      }
      return q
    })
    setExtractedQuestions(updated)
  }

  var deleteQuestion = function(qi: number) { setExtractedQuestions(extractedQuestions.filter(function(_, i) { return i !== qi })) }
  var addQuestion = function() { setExtractedQuestions(extractedQuestions.concat([{ question: '', options: ['-','-','-','-'], correct: 0 }])) }

  var handleSave = async function() {
    if (extractedQuestions.length === 0) { toast.error('مفيش أسئلة عشان تحفظ'); return }
    setSaving(true); setStatusMsg('بيحفظ في الداتابيز...')
    try {
      var fd = new FormData()
      fd.append('type', extractType); fd.append('grade', grade); fd.append('title', title)
      fd.append('questions', JSON.stringify(extractedQuestions))
      // Save endpoint: /api/ai-extract-questions
      var res = await fetch('/api/ai-extract-questions', { method: 'POST', body: fd })
      var data = await res.json()
      if (res.ok && data.success) { toast.success(data.message || 'تم الحفظ بنجاح!'); onRefresh(); resetAll() }
      else { toast.error(data.error || 'حصلت مشكلة في الحفظ') }
    } catch (err: any) { toast.error('مشكلة في الاتصال: ' + (err.message || '')) }
    setSaving(false); setStatusMsg('')
  }

  var renderStep3 = function() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={function() { setStep(2) }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><X className="h-4 w-4" /> رجوع</button>
            <Badge variant="outline" className={"text-xs " + (extractType === 'exam' ? 'border-blue-500/50 text-blue-600' : 'border-emerald-500/50 text-emerald-600')}>{extractType === 'exam' ? 'امتحان' : 'واجب'}</Badge>
            <span className="text-sm font-medium truncate">{title}</span>
            <Badge variant="secondary" className="text-xs">{grade}</Badge>
          </div>
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-0">{extractedQuestions.length} سؤال</Badge>
        </div>
        <p className="text-xs text-muted-foreground">راجع الأسئلة قبل ما تحفظ. دوس على الدايرة جناب الإجابة الصح.</p>
        {statusMsg && <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400"><Loader2 className="h-4 w-4 animate-spin" /><p className="text-sm">{statusMsg}</p></div>}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1"><Plus className="h-4 w-4" />أضف سؤال</Button>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
          {extractedQuestions.map(function(q, qi) {
            return (
              <div key={qi} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">س{qi + 1}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={function() { deleteQuestion(qi) }}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input value={q.question} onChange={function(e) { updateQuestion(qi, 'question', e.target.value) }} placeholder="نص السؤال..." className="text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map(function(opt, oi) {
                    return (
                      <div key={oi} className="flex items-center gap-1.5">
                        <button type="button" className={"w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] transition-colors " + (q.correct === oi ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary/50')} onClick={function() { updateQuestion(qi, 'correct', oi) }}>{["أ","ب","ت","ث"][oi]}</button>
                        <Input value={opt} onChange={function(e) { updateQuestion(qi, 'option_' + oi, e.target.value) }} placeholder={"الخيار " + (oi + 1)} className="h-8 text-xs" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1"><Plus className="h-4 w-4" />أضف سؤال</Button>
        </div>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={handleSave} disabled={saving || extractedQuestions.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
            {saving ? 'بيحفظ...' : 'حفظ في الداتابيز'}
          </Button>
          <Button variant="outline" onClick={resetAll}>إلغاء</Button>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" />استخراج الأسئلة بالذكاء الاصطناعي</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map(function(s) {
            var isActive = step === s
            var isDone = step > s
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={"w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors " + (isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{isDone ? <Check className="h-4 w-4" /> : s}</div>
                {s < 3 && <div className={"w-12 h-0.5 " + (isDone ? 'bg-emerald-500' : 'bg-muted')} />}
              </div>
            )
          })}
        </div>
        <div className="flex justify-center gap-6 mb-4 text-[10px] text-muted-foreground">
          <span className={step >= 1 ? 'text-primary font-medium' : ''}>النوع والبيانات</span>
          <span className={step >= 2 ? 'text-primary font-medium' : ''}>رفع واستخراج</span>
          <span className={step >= 3 ? 'text-primary font-medium' : ''}>مراجعة وحفظ</span>
        </div>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </CardContent>
    </Card>
  )
}
  
