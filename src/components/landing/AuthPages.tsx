'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useAppStore, GRADES } from '@/stores/app-store'
import { ArrowRight, User, Phone, Lock, GraduationCap, Users, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

var fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
}

var TEXT_ONLY_REGEX = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\s]+$/
var PHONE_REGEX = /^\d{11}$/

function PhoneField(props) {
  var value = props.value
  var onChange = props.onChange
  var placeholder = props.placeholder
  var id = props.id
  var error = props.error
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">{placeholder} <span className="text-destructive">*</span></Label>
      <div className="relative">
        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input id={id} placeholder={placeholder} value={value} onChange={function (e) { var v = e.target.value.replace(/[^\d]/g, ''); if (v.length <= 11) onChange(v) }} dir="ltr" className={'pr-10 min-h-[44px]' + (error ? ' border-destructive focus-visible:ring-destructive' : '')} maxLength={11} />
      </div>
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  )
}

function NameField(props) {
  var value = props.value
  var onChange = props.onChange
  var placeholder = props.placeholder
  var id = props.id
  var error = props.error
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-foreground text-xs">{placeholder} <span className="text-destructive">*</span></Label>
      <Input id={id} placeholder={placeholder} value={value} onChange={function (e) { onChange(e.target.value) }} className={'min-h-[44px]' + (error ? ' border-destructive focus-visible:ring-destructive' : '')} />
      {error && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  )
}

function PasswordField(props) {
  var value = props.value
  var onChange = props.onChange
  var placeholder = props.placeholder
  var id = props.id
  var error = props.error
  var showState = useState(false)
  var show = showState[0]
  var setShow = showState[1]
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">{placeholder} <span className="text-destructive">*</span></Label>
      <div className="relative">
        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input id={id} type={show ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={function (e) { onChange(e.target.value) }} dir="ltr" className={'pr-10 pl-10 min-h-[44px]' + (error ? ' border-destructive focus-visible:ring-destructive' : '')} autoComplete={id.includes('login') ? 'current-password' : 'new-password'} />
        <button type="button" onClick={function() { setShow(!show) }} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  )
}

export function LoginView() {
  var store = useAppStore()
  var setView = store.setView
  var setCurrentStudent = store.setCurrentStudent
  var setCurrentAdmin = store.setCurrentAdmin
  var setAdminLoggedIn = store.setAdminLoggedIn
  var loginTabState = useState('student')
  var loginTab = loginTabState[0]
  var setLoginTab = loginTabState[1]
  var phoneState = useState('')
  var studentPhone = phoneState[0]
  var setStudentPhone = phoneState[1]
  var passState1 = useState('')
  var studentPassword = passState1[0]
  var setStudentPassword = passState1[1]
  var loadState1 = useState(false)
  var studentLoading = loadState1[0]
  var setStudentLoading = loadState1[1]
  var emailState = useState('')
  var adminEmail = emailState[0]
  var setAdminEmail = emailState[1]
  var passState = useState('')
  var adminPassword = passState[0]
  var setAdminPassword = passState[1]
  var loadState2 = useState(false)
  var adminLoading = loadState2[0]
  var setAdminLoading = loadState2[1]
  var msgState = useState('')
  var adminStatusMsg = msgState[0]
  var setAdminStatusMsg = msgState[1]

  var handleStudentLogin = async function () {
    if (!studentPhone.trim()) { toast.error('الرجاء إدخال رقم الهاتف'); return }
    if (!PHONE_REGEX.test(studentPhone.trim())) { toast.error('رقم الهاتف يجب أن يكون 11 رقم'); return }
    if (!studentPassword.trim()) { toast.error('الرجاء إدخال كلمة المرور'); return }
    setStudentLoading(true)
    try {
      var res = await fetch('/api/students?phone=' + encodeURIComponent(studentPhone.trim()) + '&password=' + encodeURIComponent(studentPassword.trim()))
      var data = await res.json()
      var students = data.students || []
      var student = null
      for (var i = 0; i < students.length; i++) { if (students[i].phone === studentPhone.trim()) { student = students[i]; break } }
      if (!student) { toast.error('رقم الهاتف أو كلمة المرور غير صحيحة'); setStudentLoading(false); return }
      if (student.status === 'pending') { setCurrentStudent(student); setView('student-pending'); toast.info('حسابك قيد المراجعة، انتظر موافقة المسؤول') }
      else if (student.status === 'approved' || student.status === 'paid') { setCurrentStudent(student); setView('student-portal'); toast.success('مرحباً ' + student.name + '!'); fetch('/api/students/track-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: student.id }) }).catch(function () {}) }
      else { toast.error('تم حذف حسابك من المنصة، تواصل مع المسؤول') }
    } catch (e) { toast.error('حدث خطأ في الاتصال') }
    setStudentLoading(false)
  }

  var handleAdminLogin = async function () {
    if (!adminEmail || !adminPassword) { toast.error('الرجاء إدخال البريد وكلمة المرور'); return }
    if (adminLoading) return
    setAdminLoading(true)
    setAdminStatusMsg('جاري الاتصال بالسيرفر...')
    var controller = new AbortController()
    var timeout = setTimeout(function () { controller.abort() }, 15000)
    try {
      setAdminStatusMsg('جاري التحقق من البيانات...')
      var res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminEmail, password: adminPassword }), signal: controller.signal })
      var data = await res.json()
      if (res.ok) { setAdminStatusMsg('جاري تحميل لوحة التحكم...'); setCurrentAdmin(data.admin); setAdminLoggedIn(true); setView('admin-dashboard'); toast.success('مرحباً بك في لوحة التحكم') }
      else { toast.error(data.error || 'خطأ في تسجيل الدخول') }
    } catch (err) { if (err && err.name === 'AbortError') { toast.error('انتهت مهلة الاتصال — حاول مرة أخرى') } else { toast.error('حدث خطأ في الاتصال بالسيرفر') } }
    finally { clearTimeout(timeout); setAdminLoading(false); setAdminStatusMsg('') }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <motion.div className="w-full max-w-md" initial="hidden" animate="visible" variants={fadeInUp} transition={{ duration: 0.5, ease: 'easeOut' }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4"><GraduationCap className="h-8 w-8 text-primary" /></div>
          <h1 className="text-2xl font-bold text-foreground mb-2">تسجيل الدخول</h1>
          <p className="text-sm text-muted-foreground">ادخل إلى حسابك للمتابعة</p>
        </div>
        <div className="relative rounded-2xl p-[2px] bg-gradient-to-br from-gold-400 via-gold-600 to-gold-400">
          <Card className="rounded-2xl border-0 shadow-lg">
            <CardContent className="p-6">
              <Tabs value={loginTab} onValueChange={setLoginTab} className="w-full">
                <TabsList className="w-full h-11 mb-6">
                  <TabsTrigger value="student" className="flex-1 gap-2 min-h-[44px]"><User className="h-4 w-4" />طالب</TabsTrigger>
                  <TabsTrigger value="admin" className="flex-1 gap-2 min-h-[44px]"><Lock className="h-4 w-4" />مشرف</TabsTrigger>
                </TabsList>
                <TabsContent value="student">
                  <div className="space-y-4">
                    <PhoneField value={studentPhone} onChange={setStudentPhone} placeholder="رقم الهاتف" id="login-phone" />
                    <PasswordField value={studentPassword} onChange={setStudentPassword} placeholder="كلمة المرور" id="login-password" />
                    <Button className="w-full min-h-[44px] font-semibold" onClick={handleStudentLogin} disabled={studentLoading}>{studentLoading ? (<><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري تسجيل الدخول...</>) : 'تسجيل الدخول'}</Button>
                    <p className="text-center text-sm text-muted-foreground">ليس لديك حساب؟ <button onClick={function () { setView('auth-register') }} className="text-primary font-medium hover:underline cursor-pointer">أنشئ حساباً جديداً</button></p>
                  </div>
                </TabsContent>
                <TabsContent value="admin">
                  <div className="space-y-4">
                    <Badge variant="outline" className="mb-2 w-full justify-center py-1">دخول المشرفين فقط</Badge>
                    <div className="space-y-2"><Label htmlFor="auth-admin-email" className="text-foreground">البريد الإلكتروني</Label><Input id="auth-admin-email" type="email" placeholder="البريد الإلكتروني" value={adminEmail} onChange={function (e) { setAdminEmail(e.target.value) }} onKeyDown={function (e) { if (e.key === 'Enter' && !adminLoading) handleAdminLogin() }} dir="ltr" className="min-h-[44px]" disabled={adminLoading} autoComplete="email" /></div>
                    <div className="space-y-2"><Label htmlFor="auth-admin-password" className="text-foreground">كلمة المرور</Label><Input id="auth-admin-password" type="password" placeholder="كلمة المرور" value={adminPassword} onChange={function (e) { setAdminPassword(e.target.value) }} onKeyDown={function (e) { if (e.key === 'Enter' && !adminLoading) handleAdminLogin() }} dir="ltr" className="min-h-[44px]" disabled={adminLoading} autoComplete="current-password" /></div>
                    {adminStatusMsg && <p className="text-xs text-center text-muted-foreground animate-pulse">{adminStatusMsg}</p>}
                    <Button className="w-full min-h-[44px] font-semibold" onClick={handleAdminLogin} disabled={adminLoading}>{adminLoading ? (<><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري تسجيل الدخول...</>) : 'دخول لوحة التحكم'}</Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        <div className="mt-6 text-center"><button onClick={function () { setView('landing') }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-3 cursor-pointer"><ArrowRight className="h-4 w-4" />العودة للرئيسية</button></div>
      </motion.div>
    </div>
  )
}

export function RegisterView() {
  var store = useAppStore()
  var setView = store.setView
  var setCurrentStudent = store.setCurrentStudent
  var n1s = useState(''); var name1 = n1s[0]; var setName1 = n1s[1]
  var n2s = useState(''); var name2 = n2s[0]; var setName2 = n2s[1]
  var n3s = useState(''); var name3 = n3s[0]; var setName3 = n3s[1]
  var n4s = useState(''); var name4 = n4s[0]; var setName4 = n4s[1]
  var ps = useState(''); var phone = ps[0]; var setPhone = ps[1]
  var pwdState = useState(''); var password = pwdState[0]; var setPassword = pwdState[1]
  var pwd2State = useState(''); var password2 = pwd2State[0]; var setPassword2 = pwd2State[1]
  var gs = useState(''); var grade = gs[0]; var setGrade = gs[1]
  var p1s = useState(''); var parentName1 = p1s[0]; var setParentName1 = p1s[1]
  var p2s = useState(''); var parentName2 = p2s[0]; var setParentName2 = p2s[1]
  var pps = useState(''); var parentPhone = pps[0]; var setParentPhone = pps[1]
  var ls = useState(false); var loading = ls[0]; var setLoading = ls[1]
  var es = useState({}); var errors = es[0]; var setErrors = es[1]

  var validate = function () {
    var e = {}
    if (!name1.trim()) e.name1 = 'مطلوب'; else if (!TEXT_ONLY_REGEX.test(name1.trim())) e.name1 = 'حروف فقط'
    if (!name2.trim()) e.name2 = 'مطلوب'; else if (!TEXT_ONLY_REGEX.test(name2.trim())) e.name2 = 'حروف فقط'
    if (!name3.trim()) e.name3 = 'مطلوب'; else if (!TEXT_ONLY_REGEX.test(name3.trim())) e.name3 = 'حروف فقط'
    if (!name4.trim()) e.name4 = 'مطلوب'; else if (!TEXT_ONLY_REGEX.test(name4.trim())) e.name4 = 'حروف فقط'
    if (!phone.trim()) e.phone = 'مطلوب'; else if (!PHONE_REGEX.test(phone.trim())) e.phone = 'يجب أن يكون 11 رقم بالضبط'
    if (!password.trim()) e.password = 'مطلوب'; else if (password.trim().length < 4) e.password = 'كلمة المرور يجب أن تكون 4 أحرف على الأقل'
    if (password.trim() !== password2.trim()) e.password2 = 'كلمتا المرور غير متطابقتين'
    if (!grade) e.grade = 'مطلوب'
    if (!parentName1.trim()) e.parentName1 = 'مطلوب'; else if (!TEXT_ONLY_REGEX.test(parentName1.trim())) e.parentName1 = 'حروف فقط'
    if (!parentName2.trim()) e.parentName2 = 'مطلوب'; else if (!TEXT_ONLY_REGEX.test(parentName2.trim())) e.parentName2 = 'حروف فقط'
    if (!parentPhone.trim()) e.parentPhone = 'مطلوب'; else if (!PHONE_REGEX.test(parentPhone.trim())) e.parentPhone = 'يجب أن يكون 11 رقم بالضبط'
    setErrors(e)
    if (Object.keys(e).length > 0) { toast.error('الرجاء تصحيح الحقول المشار إليها'); return false }
    return true
  }

  var handleRegister = async function () {
    if (!validate()) return
    var fullName = name1.trim() + ' ' + name2.trim() + ' ' + name3.trim() + ' ' + name4.trim()
    var fullParentName = parentName1.trim() + ' ' + parentName2.trim()
    setLoading(true)
    try {
      var res = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: fullName, phone: phone.trim(), grade: grade, parentName: fullParentName, parentPhone: parentPhone.trim(), password: password.trim() }) })
      var data = await res.json()
      if (res.ok) { setCurrentStudent(data.student); setView('student-pending'); toast.success('تم تسجيل طلبك بنجاح! انتظر موافقة المسؤول') }
      else { toast.error(data.error || 'حدث خطأ في التسجيل') }
    } catch (e) { toast.error('حدث خطأ في الاتصال') }
    setLoading(false)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      <motion.div className="w-full max-w-lg" initial="hidden" animate="visible" variants={fadeInUp} transition={{ duration: 0.5, ease: 'easeOut' }}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-3"><Users className="h-7 w-7 text-primary" /></div>
          <h1 className="text-2xl font-bold text-foreground mb-1">إنشاء حساب جديد</h1>
          <p className="text-sm text-muted-foreground">سجل بياناتك وابدأ رحلة التعلم</p>
        </div>
        <div className="relative rounded-2xl p-[2px] bg-gradient-to-br from-gold-400 via-gold-600 to-gold-400">
          <Card className="rounded-2xl border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">اسم الطالب الرباعي</p>
                  <div className="grid grid-cols-2 gap-2">
                    <NameField value={name1} onChange={setName1} placeholder="الاسم الأول" id="reg-name1" error={errors.name1} />
                    <NameField value={name2} onChange={setName2} placeholder="الاسم الثاني" id="reg-name2" error={errors.name2} />
                    <NameField value={name3} onChange={setName3} placeholder="الاسم الثالث" id="reg-name3" error={errors.name3} />
                    <NameField value={name4} onChange={setName4} placeholder="الاسم الرابع" id="reg-name4" error={errors.name4} />
                  </div>
                </div>
                <PhoneField value={phone} onChange={setPhone} placeholder="رقم هاتف الطالب" id="reg-phone" error={errors.phone} />
                <div className="grid grid-cols-2 gap-2">
                  <PasswordField value={password} onChange={setPassword} placeholder="كلمة المرور" id="reg-password" error={errors.password} />
                  <PasswordField value={password2} onChange={setPassword2} placeholder="تأكيد كلمة المرور" id="reg-password2" error={errors.password2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-grade" className="text-foreground">الصف الدراسي <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <GraduationCap className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select id="reg-grade" value={grade} onChange={function (e) { setGrade(e.target.value) }} className={'flex h-11 w-full rounded-md border border-input bg-transparent pr-10 pl-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[44px] appearance-none cursor-pointer' + (errors.grade ? ' border-destructive' : '')}>
                      <option value="">اختر الصف الدراسي</option>
                      {GRADES.map(function (g) { return <option key={g} value={g}>{g}</option> })}
                    </select>
                  </div>
                  {errors.grade && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.grade}</p>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">اسم ولي الأمر</p>
                  <div className="grid grid-cols-2 gap-2">
                    <NameField value={parentName1} onChange={setParentName1} placeholder="الاسم الأول" id="reg-pname1" error={errors.parentName1} />
                    <NameField value={parentName2} onChange={setParentName2} placeholder="الاسم الثاني" id="reg-pname2" error={errors.parentName2} />
                  </div>
                </div>
                <PhoneField value={parentPhone} onChange={setParentPhone} placeholder="رقم هاتف ولي الأمر" id="reg-parent-phone" error={errors.parentPhone} />
                <Button className="w-full min-h-[44px] font-semibold" onClick={handleRegister} disabled={loading}>{loading ? (<><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري التسجيل...</>) : 'إنشاء الحساب'}</Button>
                <p className="text-center text-sm text-muted-foreground">لديك حساب بالفعل؟ <button onClick={function () { setView('auth-login') }} className="text-primary font-medium hover:underline cursor-pointer">سجل دخولك</button></p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="mt-6 text-center"><button onClick={function () { setView('landing') }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-3 cursor-pointer"><ArrowRight className="h-4 w-4" />العودة للرئيسية</button></div>
      </motion.div>
    </div>
  )
}
