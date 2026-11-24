// ============================================================
// VIDEO OPEN LOG — (ر5 — طلب المستر) سجل فتح الفيديوهات على السيرفر
// ============================================================
// الطبقة الصارمة لميزة «فخ الفيديو»: العد التنازلي 10 ثواني بيشتغل
// على شاشة الطالب (كلاينت) — بس اللص اللي بيفتح أدوات المطوّر ممكن
// يحجب طلب الرفض من الـ Network أو يجمّد الصفحة من الـ debugger.
// هنا السيرفر بيسجل **فتح أي فيديو لطالب مسجل** لحظة إصدار التذكرة
// (من /api/video-ticket)، ولو الفتح فضل مقفولش أهو أكتر من 60 ثانية
// (القفل الطبيعي بييجي في أقل من 10 ثواني) → الحساب بيتوضع rejected
// تلقائيًا أول ما الطالب يمسك أي مسار تاني (دخول جديد / تذكرة جديدة)
// — حتى لو حجب كل طلبات المنصة من أدوات المطوّر.
// الجدول بيتعمل self-heal بنفس نمط ensurePlayTicketTable الموجود
// في video-guard.ts — من غير أي تعديل في schema.prisma.
import { db } from '@/lib/db'

/* مهلة السماح على السيرفر — العد على الشاشة 10 ثواني والقفل الطبيعي
   بيوصل قبلها؛ 60 ثانية سماح على السيرفر عشان أي تأخير شبكة بسيط
   ما يظلمش طالب قفل في الوقت */
export const VIDEO_OPEN_LIMIT_MS = 60 * 1000

var _openLogReady = false
export async function ensureVideoOpenLogTable(force = false): Promise<void> {
  if (_openLogReady && !force) return
  try {
    await db.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS VideoOpenLog (id INTEGER PRIMARY KEY AUTOINCREMENT, studentId TEXT NOT NULL, videoId TEXT NOT NULL, openedAt INTEGER NOT NULL, closedAt INTEGER NOT NULL DEFAULT 0)'
    )
    try {
      await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_vol_student ON VideoOpenLog(studentId, closedAt)')
    } catch (eIdx) { /* الفهرس اختياري */ }
    _openLogReady = true
  } catch (e) {
    console.error('ensureVideoOpenLogTable error:', e)
  }
}

/* تسجيل فتح فيديو لطالب — بنقفل أي فتح قديم لسه مفتوح (إعادة فتح طبيعية
   بعد رجوع الطالب = الفتح القديم بعتبر اتقفل) */
export async function logVideoOpen(studentId: string, videoId: string): Promise<void> {
  if (!studentId || String(studentId).indexOf('temp-') === 0) return
  try {
    await ensureVideoOpenLogTable()
    var now = Date.now()
    try {
      await db.$executeRawUnsafe('UPDATE VideoOpenLog SET closedAt = ? WHERE studentId = ? AND closedAt = 0', now, String(studentId))
    } catch (eUp) {}
    await db.$executeRawUnsafe(
      'INSERT INTO VideoOpenLog (studentId, videoId, openedAt) VALUES (?, ?, ?)',
      String(studentId), String(videoId || ''), now
    )
  } catch (e) {
    console.error('logVideoOpen error:', e)
  }
}

/* قفل سجل الفتح — بييجي من مودال المشغل أول ما الفيديو يتقفل
   (fire and forget — فشلها ما يضرش، الـ sweep بيغطي) */
export async function markVideoClosed(studentId: string): Promise<void> {
  if (!studentId || String(studentId).indexOf('temp-') === 0) return
  try {
    await ensureVideoOpenLogTable()
    await db.$executeRawUnsafe(
      'UPDATE VideoOpenLog SET closedAt = ? WHERE studentId = ? AND closedAt = 0',
      Date.now(), String(studentId)
    )
  } catch (e) {}
}

/* الفحص الصارم: فتح عالق من غير قفل أكتر من 60 ثانية = الطالب عاند
   بعد مهلة التحذير → الحساب يترفض نهائيًا (status=rejected) + السبب
   بيتسجل في النشاط عشان المستر يشوفه في اللوحة.
   بترجع true لو الحساب اترفض دلوقتي. */
export async function sweepStaleVideoOpens(studentId: string): Promise<boolean> {
  if (!studentId || String(studentId).indexOf('temp-') === 0) return false
  try {
    await ensureVideoOpenLogTable()
    var stale: any[] = await db.$queryRawUnsafe(
      'SELECT id, videoId, openedAt FROM VideoOpenLog WHERE studentId = ? AND closedAt = 0 ORDER BY openedAt ASC LIMIT 5',
      String(studentId)
    )
    var cutoff = Date.now() - VIDEO_OPEN_LIMIT_MS
    for (var i = 0; i < (stale || []).length; i++) {
      var row: any = stale[i]
      var openedAt = Number(row && row.openedAt ? row.openedAt : 0)
      if (!openedAt || openedAt >= cutoff) continue
      /* فتح عالق حقيقي — نتأكد إن الطالب موجود ومش مرفوض أصلًا */
      var st: any = null
      try { st = await db.student.findUnique({ where: { id: String(studentId) } }) } catch (eS) { st = null }
      if (!st) return false
      var stStatus = String((st as any).status || '')
      if (stStatus === 'rejected' || stStatus === 'refused') {
        /* مرفوض من قبل — ننضف السجل العالق بس من غير تكرار */
        try { await db.$executeRawUnsafe('UPDATE VideoOpenLog SET closedAt = ? WHERE studentId = ?', Date.now(), String(studentId)) } catch (eC) {}
        return false
      }
      try {
        await db.student.update({ where: { id: String(studentId) }, data: { status: 'rejected' } })
        try {
          await db.studentActivity.create({
            data: {
              studentId: String(studentId),
              action: 'security_rejected',
              details: 'اترفض تلقائيًا من طبقة السيرفر: فضل فاتح فيديو بعد مهلة التحذير (10 ثواني) وقفل السجل ما وصلش — ' + new Date().toLocaleString('ar-EG'),
            },
          })
        } catch (eA) {}
      } catch (eU) { console.error('sweepStaleVideoOpens reject error:', eU) }
      try { await db.$executeRawUnsafe('UPDATE VideoOpenLog SET closedAt = ? WHERE studentId = ?', Date.now(), String(studentId)) } catch (eC2) {}
      return true
    }
  } catch (e) {
    console.error('sweepStaleVideoOpens error:', e)
  }
  return false
}
