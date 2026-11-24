import { NextRequest, NextResponse } from 'next/server'
import { markVideoClosed } from '@/lib/video-open-log'

export const runtime = 'nodejs'

// ============================================================
// (ر5) POST /api/video-open/close
// ============================================================
// بلاغ «الفيديو اتقفل» من مودال المشغل (fire and forget — keepalive
// أو sendBeacon) — بيقفل سجل الفتح المفتوح في VideoOpenLog.
// ده الجزء النضيف من منظومة فخ الفيديو: لو الطالب حجب الطلب ده من
// أدوات المطوّر، السجل يفضل مفتوح والـ sweep على السيرفر بيرفض
// حسابه أول ما يمسك أي مسار تاني. الطلب ما بيضرش لو اتكرر أو
// اتلعب فيه — أقصى اللي يعمله أي حد إنه يقفل سجل فتح (بيساعد
// صاحبه) — مفيش أي أذى ممكن ياخده من الراوت ده.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    var body: any = {}
    try { body = await request.json() } catch (e) { body = {} }
    var studentId = String(body && body.studentId ? body.studentId : '')
    if (studentId) await markVideoClosed(studentId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: true })
  }
}
