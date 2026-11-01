// @ts-nocheck
// Upload files to Media table (base64) - no external services needed
//
// 2026-و19 — إصلاح علة «الورقة مش كاملة» من جذرها:
//   الكود القديم كان بيحفظ كل chunk كصف Media مستقل ويرجّع done:true فورًا،
//   فالكلينت (chunked-upload.ts) بيوقف الرفع بعد أول جزء — أي صورة/ملف
//   أكبر من 2MB كان بيتم تخزينه **مقطوع** (أول 2MB بس) والباقي بيضيع
//   نهائيًا → ورقة حل الطالب بتوصل للتصحيح ناقصة والـ AI بيقول
//   «الورقة غير مكتملة» ويحسب غلط على حل صحيح.
//   دلوقتي: الأجزاء بتتخزن مؤقتًا في جدول Media بعلامة __chunks/<uploadId>/<i>
//   ولما آخر جزء يوصل بتتجمع بالترتيب في صف واحد نهائي — الصورة كاملة
//   100% زي ما الطالب صوّرها، وأي retry لجزء بيكتب فوق القديم بأمان.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const maxDuration = 60

// بادئة صفوف الأجزاء المؤقتة — مش بتظهر كملف نهائي أبدًا
var CHUNK_PREFIX = '__chunks/'
// الأجزاء اللي مكتملش رفعها من أكتر من يوم بتتشال أوتوماتيك (رفع فاشل مهجور)
var CHUNK_TTL_MS = 24 * 60 * 60 * 1000

function chunkSlotPath(uploadId: string, index: number): string {
  return CHUNK_PREFIX + uploadId + '/' + index
}

function parseIndexFromPath(filePath: string): number {
  // __chunks/<uploadId>/<index> → index رقمي (ترتيب رقمي مش نصي)
  var tail = filePath.substring(filePath.lastIndexOf('/') + 1)
  var n = parseInt(tail, 10)
  return isNaN(n) ? -1 : n
}

/* (ز33) شفاء أعمدة Media الناقصة في قواعد الإنتاج القديمة —
   عمود filename كان ناقص فكل رفع بيرجع 500 «فشلت العملية» */
var _mediaColsReady = false
async function ensureMediaColumns() {
  if (_mediaColsReady) return
  try {
    try { await db.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS Media (id TEXT PRIMARY KEY, filePath TEXT NOT NULL DEFAULT '', filename TEXT NOT NULL DEFAULT '', fileType TEXT NOT NULL DEFAULT 'application/octet-stream', fileSize TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'general', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME)") } catch (e) {}
    /* (ز33) لو Media موجودة كـ VIEW (حصل في قواعد قديمة) — الإدراج بيرجع
       SQLITE_MISMATCH. بنحذف الـ view ونعمل الجدول الصحيح. */
    try {
      var anyRows: any[] = (await db.$queryRawUnsafe("SELECT type, sql FROM sqlite_master WHERE name='Media'")) || []
      var existingType = String((anyRows[0] && anyRows[0].type) || '')
      if (existingType === 'view') {
        try { await db.$executeRawUnsafe('DROP VIEW IF EXISTS Media') } catch (e) {}
        try { await db.$executeRawUnsafe("CREATE TABLE Media (id TEXT PRIMARY KEY, filePath TEXT NOT NULL DEFAULT '', filename TEXT NOT NULL DEFAULT '', fileType TEXT NOT NULL DEFAULT 'application/octet-stream', fileSize TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'general', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME)") } catch (e) {}
      }
    } catch (eView) {}
    /* (ز33) لو الجدول القديم معمول بـ id INTEGER (قاعدة قديمة) — Prisma بيدخل
       cuid نصي فبيرجع SQLITE_MISMATCH لكل رفع. الترحيل: جدول جديد صحيح
       + نسخ البيانات القديمة + استبدال. */
    try {
      var ddlRows: any[] = (await db.$queryRawUnsafe("SELECT sql FROM sqlite_master WHERE type='table' AND name='Media'")) || []
      var ddlSql = String((ddlRows[0] && ddlRows[0].sql) || '')
      if (/id\s+INTEGER\s+PRIMARY\s+KEY/i.test(ddlSql)) {
        try { await db.$executeRawUnsafe('ALTER TABLE Media RENAME TO Media_broken_z33') } catch (e) {}
        try {
          await db.$executeRawUnsafe("CREATE TABLE Media (id TEXT PRIMARY KEY, filePath TEXT NOT NULL DEFAULT '', filename TEXT NOT NULL DEFAULT '', fileType TEXT NOT NULL DEFAULT 'application/octet-stream', fileSize TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'general', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME)")
          // نسخ البيانات القديمة — بكل الأعمدة المعروفة، ولو فشل ننسخ الأساسيات بس
          try {
            await db.$executeRawUnsafe("INSERT OR IGNORE INTO Media (id, filePath, filename, fileType, fileSize, data, category, createdAt) SELECT CAST(id AS TEXT), IFNULL(filePath,''), IFNULL(filename,''), IFNULL(fileType,'application/octet-stream'), IFNULL(fileSize,''), IFNULL(data,''), IFNULL(category,'general'), IFNULL(createdAt, CURRENT_TIMESTAMP) FROM Media_broken_z33")
          } catch (eFull) {
            try {
              await db.$executeRawUnsafe("INSERT OR IGNORE INTO Media (id, data, createdAt) SELECT CAST(id AS TEXT), IFNULL(data,''), IFNULL(createdAt, CURRENT_TIMESTAMP) FROM Media_broken_z33")
            } catch (eMin) {}
          }
          try { await db.$executeRawUnsafe('DROP TABLE Media_broken_z33') } catch (e) {}
        } catch (eCreate) {
          // لو فشل الإنشاء نرجّع القديم باسمه
          try { await db.$executeRawUnsafe('ALTER TABLE Media_broken_z33 RENAME TO Media') } catch (e) {}
        }
      }
    } catch (eDdl) {}
    try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN filePath TEXT NOT NULL DEFAULT ''") } catch (e) {}
    try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN filename TEXT NOT NULL DEFAULT ''") } catch (e) {}
    try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN fileType TEXT NOT NULL DEFAULT 'application/octet-stream'") } catch (e) {}
    try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN fileSize TEXT NOT NULL DEFAULT ''") } catch (e) {}
    try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN category TEXT NOT NULL DEFAULT 'general'") } catch (e) {}
    try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN data TEXT NOT NULL DEFAULT ''") } catch (e) {}
    try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP") } catch (e) {}
    try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN updatedAt DATETIME") } catch (e) {}

    _mediaColsReady = true
  } catch (e) {}
}

export async function POST(req: NextRequest) {
  try {
    await ensureMediaColumns()
    var formData = await req.formData()
    var file = formData.get('file') as File | null
    var uploadId = String(formData.get('uploadId') || '').replace(/[^a-zA-Z0-9\-]/g, '')
    var fileName = (formData.get('fileName') as string) || 'file'
    var category = (formData.get('category') as string) || 'general'
    var chunkIndex = parseInt(String(formData.get('chunkIndex') ?? '0'), 10) || 0
    var totalChunks = parseInt(String(formData.get('totalChunks') ?? '1'), 10) || 1
    if (totalChunks < 1) totalChunks = 1
    if (chunkIndex < 0) chunkIndex = 0

    if (!file) {
      return NextResponse.json({ error: 'مفيش ملف' }, { status: 400 })
    }

    var arrayBuffer = await file.arrayBuffer()
    var buffer = Buffer.from(arrayBuffer)
    var base64 = buffer.toString('base64')

    var safeName = fileName.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, '_')
    var filePath = category + '/' + Date.now() + '_' + safeName
    var fileType = file.type || 'application/octet-stream'

    // =====================================================
    // الحالة 1: ملف صغير (جزء واحد) — حفظ مباشر زي ما هو
    // =====================================================
    if (totalChunks === 1) {
      var media = await db.media.create({
        data: {
          filename: fileName,
          filePath: filePath,
          fileType: fileType,
          fileSize: String(buffer.length),
          data: base64,
          category: category,
        },
      })

      return NextResponse.json({
        filePath: '/api/files/' + media.id,
        fileType: fileType,
        filename: fileName,
        size: buffer.length,
        done: true,
      })
    }

    // =====================================================
    // الحالة 2: رفع مجزأ — تخزين مؤقت للجزء الحالي
    // (delete ثم create = كتابة فوق آمنة لو حصل retry لنفس الجزء)
    // =====================================================
    if (!uploadId) {
      return NextResponse.json({ error: 'uploadId مفقود للرفع المجزأ' }, { status: 400 })
    }

    // تنظيف الأجزاء المهجورة من رفعات فاشلة قديمة (بأمان — لو فشل مبيأثرش)
    await cleanupOrphanChunks()

    var slotPath = chunkSlotPath(uploadId, chunkIndex)
    await db.media.deleteMany({ where: { filePath: slotPath } })
    await db.media.create({
      data: {
        filename: fileName,
        filePath: slotPath,
        fileType: fileType,
        fileSize: String(buffer.length),
        data: base64,
        category: '__chunk__',
      },
    })

    // لسه مش آخر جزء — الخزانة شغالة، الكلينت هيكمل باقي الأجزاء
    if (chunkIndex < totalChunks - 1) {
      return NextResponse.json({
        done: false,
        chunkIndex: chunkIndex,
        totalChunks: totalChunks,
        received: buffer.length,
      })
    }

    // =====================================================
    // الحالة 3: آخر جزء وصل — تجميع كل الأجزاء بالترتيب في ملف واحد
    // =====================================================
    var parts = await db.media.findMany({
      where: { filePath: { startsWith: CHUNK_PREFIX + uploadId + '/' } },
      orderBy: { createdAt: 'asc' },
    })

    // ترتيب رقمي بالفهرس (مش نصي عشان 10 ما تجيش قبل 2)
    parts.sort(function (a: any, b: any) {
      return parseIndexFromPath(a.filePath) - parseIndexFromPath(b.filePath)
    })

    if (parts.length < totalChunks) {
      // جزء ناقص (فشل شبكة في جزء وسطى) — رسالة واضحة والكلينت يعرضها
      return NextResponse.json(
        {
          error: 'اتستلم ' + parts.length + ' جزء من ' + totalChunks + ' — حاول ترفع الملف تاني',
          received: parts.length,
          totalChunks: totalChunks,
        },
        { status: 400 }
      )
    }

    // التجميع بالترتيب — الصورة/الملف كاملة زي ما اتبعتت
    var buffers: Buffer[] = []
    var totalSize = 0
    for (var i = 0; i < totalChunks; i++) {
      var chunkData = parts[i].data || ''
      var chunkBuf = Buffer.from(chunkData, 'base64')
      buffers.push(chunkBuf)
      totalSize += chunkBuf.length
    }
    var full = Buffer.concat(buffers)
    var fullBase64 = full.toString('base64')

    // الصف النهائي + تنظيف الأجزاء المؤقتة
    var finalMedia = await db.media.create({
      data: {
        filename: fileName,
        filePath: filePath,
        fileType: fileType,
        fileSize: String(totalSize),
        data: fullBase64,
        category: category,
      },
    })
    await db.media.deleteMany({
      where: { filePath: { startsWith: CHUNK_PREFIX + uploadId + '/' } },
    })

    return NextResponse.json({
      filePath: '/api/files/' + finalMedia.id,
      fileType: fileType,
      filename: fileName,
      size: totalSize,
      done: true,
    })
  } catch (err: any) {
    console.error('Upload error:', err)
    var ddlDump = 'no-table'
    try {
      var dd: any[] = (await db.$queryRawUnsafe("SELECT type, sql FROM sqlite_master WHERE name='Media'")) || []
      ddlDump = String((dd[0] && dd[0].type) + ' | ' + ((dd[0] && dd[0].sql) || '')).slice(0, 500)
    } catch (eD) { ddlDump = 'q-err: ' + String(eD && eD.message).slice(0, 120) }
    try {
      await db.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS Media (id TEXT PRIMARY KEY, filePath TEXT NOT NULL DEFAULT '', filename TEXT NOT NULL DEFAULT '', fileType TEXT NOT NULL DEFAULT 'application/octet-stream', fileSize TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'general', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME)")
      ddlDump += ' | create-ok'
    } catch (eC: any) {
      ddlDump += ' | create-err: ' + String(eC && eC.message).slice(0, 200)
    }
    return NextResponse.json({ error: err.message || 'حصلت مشكلة في الرفع', mediaDdl: ddlDump }, { status: 500 })
  }
}

// تنظيف الأجزاء المهجورة (رفع اتبدأ وماكملش خلال يوم) — بيشتغل مع كل
// رفع مجزأ بس، والفحص على filePath فمبيقرأش البلوبات نفسها
async function cleanupOrphanChunks() {
  try {
    await db.media.deleteMany({
      where: {
        filePath: { startsWith: CHUNK_PREFIX },
        createdAt: { lt: new Date(Date.now() - CHUNK_TTL_MS) },
      },
    })
  } catch (e) {
    // التنظيف خدمة إضافية — فشله مبيوقفش الرفع
  }
}
