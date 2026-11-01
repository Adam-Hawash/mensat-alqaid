// @ts-nocheck
// ============================================================
// (Z-36b) /api/site-config — مُصلّب أمنيًا:
// - GET كان بيرجّع كل صفوف SiteConfig الخام (حتى الأسرار زي
//   session_secret لو موجودة) لأي زائر — دلوقتي بيرجّع المفاتيح
//   العامة بس (PUBLIC_KEYS) بشكل مقصوص {key, value, updatedAt}،
//   ولو عايز كل الصفوف لازم ?all=1 + adminId أدمن صحيح.
// - PUT/POST كانوا مفتوحين لأي حد يكتب أي مفتاح — دلوقتي الكتابة
//   محتاجة أدمن موثّق بنفس نظام adminId بتاع المنصة (video-guard).
// - session_secret ممنوع يُكتب من هنا خالص (403) مهما كانت الصلاحيات.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/video-guard'

// المفاتيح العامة اللي مسموح تخرج للزوار من غير توثيق:
// grades_data + schedule_data (الصفوف والمواعيد)، video_sequence_lock
// (قفل تسلسل الفيديو)، وwm_* (إعدادات الووترمارك بتاعة حماية الفيديو).
var PUBLIC_KEYS = ['grades_data', 'schedule_data', 'video_sequence_lock', 'wm_enabled', 'wm_opacity', 'wm_interval']

function isPublicKey(key) {
  return PUBLIC_KEYS.indexOf(key) !== -1
}

export async function GET(request: NextRequest) {
  try {
    var sp = new URL(request.url).searchParams
    var wantsAll = sp.get('all') === '1'
    // طلب كل الصفوف الخام = أدمن بس
    if (wantsAll && (await isAdmin(sp.get('adminId')))) {
      const all = await db.siteConfig.findMany({ orderBy: { updatedAt: 'desc' } })
      return NextResponse.json(all)
    }
    // أي حد تاني: المفاتيح العامة بس وبشكل مقصوص (من غير أي أعمدة زيادة)
    const configs = await db.siteConfig.findMany({ orderBy: { updatedAt: 'desc' } })
    var publics = []
    for (var i = 0; i < configs.length; i++) {
      var c = configs[i]
      if (isPublicKey(c.key)) {
        publics.push({ key: c.key, value: c.value, updatedAt: c.updatedAt })
      }
    }
    return NextResponse.json(publics)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    var body = await request.json()
    var key = body && body.key
    var value = body && body.value
    // تحقق من المفتاح: نص غير فاضي ≤ 120 حرف
    if (typeof key !== 'string' || key.length === 0 || key.length > 120) {
      return NextResponse.json({ error: 'مفتاح غير صالح' }, { status: 400 })
    }
    // الأسرار ممنوع تُكتب من هنا مهما كانت الصلاحيات
    if (key === 'session_secret') {
      return NextResponse.json({ error: 'مفتاح محمي' }, { status: 403 })
    }
    // الكتابة لأي مفتاح = أدمن موثّق بس
    var adminId = new URL(request.url).searchParams.get('adminId')
    if (!(await isAdmin(adminId))) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    const updated = await db.siteConfig.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: { key, value },
    })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    var body = await request.json()
    var key = body && body.key
    var value = body && body.value
    // نفس تحقق PUT بالظبط
    if (typeof key !== 'string' || key.length === 0 || key.length > 120) {
      return NextResponse.json({ error: 'مفتاح غير صالح' }, { status: 400 })
    }
    if (key === 'session_secret') {
      return NextResponse.json({ error: 'مفتاح محمي' }, { status: 403 })
    }
    var adminId = new URL(request.url).searchParams.get('adminId')
    if (!(await isAdmin(adminId))) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    // كانت create بيفشل لو المفتاح موجود — بقت upsert للأمان (نفس سلوك PUT)
    const upserted = await db.siteConfig.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: { key, value },
    })
    return NextResponse.json(upserted)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create config' }, { status: 500 })
  }
}
