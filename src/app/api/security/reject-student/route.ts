import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { markVideoClosed } from '@/lib/video-open-log'

export const runtime = 'nodejs'

// ============================================================
// (ر5) POST /api/security/reject-student
// ============================================================
// بيترفض حساب الطالب نهائيًا (status = rejected) لما مهلة التحذير
// (10 ثواني) تخلص في حارس فخ الفيديو/أدوات المطوّر — طلب المستر
// الحرفي: «حسابه هيترفض من المنصة تماما ومش هيقدر يدخل على المنصة
// تاني... وانا اللي اقدر ارقمه من صفحة الادمن بس».
// الرفض مش مسح — الحساب بيفضل موجود والمستر يقدر يعيد تفعيله من
// لوحة الأدمن (زرار «إعادة التفعيل»).
//
// الحماية من التلاعب: نفس حماية devtools-strike — الطلب لازم يجي
// **من نفس جهاز الحساب** (بصمة deviceId/deviceFp/creationDevice*)
// يعني مينفش حد يمسح أو يرفض حساب طالب تاني من جهازه.
// لو مفيش تطابق → رد صامت ok:true من غير أي رفض.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    var body: any = {}
    try { body = await request.json() } catch (e) { body = {} }
    var studentId = String(body.studentId || '')
    if (!studentId || studentId.indexOf('temp-') === 0) {
      return NextResponse.json({ ok: true, rejected: false })
    }

    var student: any = null
    try { student = await db.student.findUnique({ where: { id: studentId } }) } catch (e) { student = null }
    if (!student) return NextResponse.json({ ok: true, rejected: false })

    /* إثبات الجهاز: بصمة الجهاز المرسلة لازم تطابق بصمات جهاز الحساب */
    var sent: string[] = []
    try {
      if (body.deviceId) sent.push(String(body.deviceId))
      if (Array.isArray(body.candidates)) {
        for (var i = 0; i < body.candidates.length; i++) {
          if (body.candidates[i]) sent.push(String(body.candidates[i]))
        }
      }
    } catch (e) {}
    var owned = [student.deviceId, student.deviceFp, student.creationDeviceId, student.creationDeviceFp]
      .filter(Boolean)
      .map(function (x: any) { return String(x) })
    var deviceMatch = false
    for (var s = 0; s < sent.length; s++) {
      if (sent[s] && owned.indexOf(sent[s]) !== -1) { deviceMatch = true; break }
    }
    if (!deviceMatch) return NextResponse.json({ ok: true, rejected: false, reason: 'device-mismatch' })

    var stStatus = String(student.status || '')
    if (stStatus === 'rejected' || stStatus === 'refused') {
      return NextResponse.json({ ok: true, rejected: true, already: true })
    }

    /* الرفض النهائي — من غير أي مسح (المستر يقدر يرجّعه من اللوحة) */
    try {
      await db.student.update({ where: { id: studentId }, data: { status: 'rejected' } })
      var why = String(body.reason || '') === 'devtools' ? 'فتح أدوات المطوّر بعد التحذير' : 'فتح فيديو وما قفلهوش في مهلة التحذير (10 ثواني)'
      try {
        await db.studentActivity.create({
          data: {
            studentId: studentId,
            action: 'security_rejected',
            details: 'اترفض تلقائيًا: ' + why + ' — من جهاز الحساب نفسه — ' + new Date().toLocaleString('ar-EG'),
          },
        })
      } catch (eA) {}
    } catch (eU) {
      console.error('reject-student update error:', eU)
    }

    /* لو كان فاتح فيديو — نقفل سجل الفتح (نضافة) */
    try { await markVideoClosed(studentId) } catch (eC) {}

    return NextResponse.json({ ok: true, rejected: true })
  } catch (error: any) {
    console.error('reject-student error:', error)
    return NextResponse.json({ ok: false, error: error.message || 'Server error' }, { status: 200 })
  }
}
