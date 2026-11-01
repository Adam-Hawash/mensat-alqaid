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
import crypto from 'crypto'
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
  var tail = filePath.substring(filePath.lastIndexOf('/') + 1)
  var n = parseInt(tail, 10)
  return isNaN(n) ? 0 : n
}

/* (ز33) كل عمليات Media هنا **Raw SQL خالص** — على قاعدة القائد الإنتاجية
   Prisma model كان بيتكلم مع سكيما مختلفة (SQLITE_MISMATCH) بينما Raw
   شغال 100% — فالرفع كله بقى Raw متسق: إنشاء الجدول + الإدراج + القراءة.
   وشغّال على SQLite المحلي وTurso بغض النظر عن سكيما Prisma. */

var MEDIA_DDL = "CREATE TABLE IF NOT EXISTS Media (id TEXT PRIMARY KEY, filePath TEXT NOT NULL DEFAULT '', filename TEXT NOT NULL DEFAULT '', fileType TEXT NOT NULL DEFAULT 'application/octet-stream', fileSize TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'general', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME)"

var _mediaReady = false
async function ensureMediaRaw(): Promise<void> {
  if (_mediaReady) return
  try {
    // 1) لو فيه كائن اسمه Media (جدول قديم مكسور أو view) — نشيله ونظبطه
    try {
      var existing: any[] = (await db.$queryRawUnsafe("SELECT type, sql FROM sqlite_master WHERE name='Media'")) || []
      var e0 = existing[0]
      var eType = e0 ? (Array.isArray(e0) ? e0[0] : e0.type) : ''
      var eSql = e0 ? String(Array.isArray(e0) ? e0[1] : (e0.sql || '')) : ''
      var broken = !e0 || eType === 'view' || /id\s+INTEGER\s+PRIMARY\s+KEY/i.test(eSql)
      if (broken && e0) {
        // جدول قديم فيه بيانات؟ نرحّل اللي نقدر عليه
        try { await db.$executeRawUnsafe('ALTER TABLE Media RENAME TO Media_broken_z33') } catch (e) {}
        try {
          await db.$executeRawUnsafe(MEDIA_DDL.replace('IF NOT EXISTS ', ''))
          try {
            await db.$executeRawUnsafe("INSERT OR IGNORE INTO Media (id, filePath, filename, fileType, fileSize, data, category, createdAt) SELECT CAST(id AS TEXT), IFNULL(filePath,''), IFNULL(filename,''), IFNULL(fileType,'application/octet-stream'), IFNULL(fileSize,''), IFNULL(data,''), IFNULL(category,'general'), IFNULL(createdAt, CURRENT_TIMESTAMP) FROM Media_broken_z33")
          } catch (eFull) {
            try { await db.$executeRawUnsafe("INSERT OR IGNORE INTO Media (id, data, createdAt) SELECT CAST(id AS TEXT), IFNULL(data,''), IFNULL(createdAt, CURRENT_TIMESTAMP) FROM Media_broken_z33") } catch (eMin) {}
          }
          try { await db.$executeRawUnsafe('DROP TABLE Media_broken_z33') } catch (e) {}
        } catch (eCreate) {
          try { await db.$executeRawUnsafe('ALTER TABLE Media_broken_z33 RENAME TO Media') } catch (e) {}
        }
      } else if (!e0) {
        await db.$executeRawUnsafe(MEDIA_DDL)
      }
      // 2) أعمدة ناقصة على قواعد قديمة — ALTER متسامح
      try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN filePath TEXT NOT NULL DEFAULT ''") } catch (e) {}
      try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN filename TEXT NOT NULL DEFAULT ''") } catch (e) {}
      try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN fileType TEXT NOT NULL DEFAULT 'application/octet-stream'") } catch (e) {}
      try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN fileSize TEXT NOT NULL DEFAULT ''") } catch (e) {}
      try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN category TEXT NOT NULL DEFAULT 'general'") } catch (e) {}
      try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN data TEXT NOT NULL DEFAULT ''") } catch (e) {}
      try { await db.$executeRawUnsafe("ALTER TABLE Media ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP") } catch (e) {}
      _mediaReady = true
    } catch (e) {}
  } catch (e) {}
}

function newMediaId(): string {
  return 'm' + Date.now().toString(36) + crypto.randomBytes(6).toString('hex')
}

async function mediaInsert(fileName: string, filePath: string, fileType: string, sizeBytes: number, base64: string, category: string): Promise<string> {
  var id = newMediaId()
  await db.$executeRawUnsafe(
    "INSERT INTO Media (id, filePath, filename, fileType, fileSize, data, category, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    id, filePath, fileName, fileType, String(sizeBytes), base64, category
  )
  return id
}

async function mediaDeleteByPathPrefix(prefix: string): Promise<void> {
  try { await db.$executeRawUnsafe('DELETE FROM Media WHERE filePath LIKE ?', prefix + '%') } catch (e) {}
}

async function cleanupOrphanChunks(): Promise<void> {
  try {
    var cutoffSec = Math.floor((Date.now() - CHUNK_TTL_MS) / 1000)
    try { await db.$executeRawUnsafe("DELETE FROM Media WHERE filePath LIKE ? AND createdAt < datetime(?, 'unixepoch')", CHUNK_PREFIX + '%', cutoffSec) } catch (e) {
      // fallback بدون شرط الوقت (قواعد قديمة) — نفس الآمن: مفيش بيانات نهائية تتمسح
      try { await db.$executeRawUnsafe('DELETE FROM Media WHERE filePath LIKE ?', CHUNK_PREFIX + '%') } catch (e2) {}
    }
  } catch (e) {}
}

export async function POST(req: NextRequest) {
  try {
    await ensureMediaRaw()
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
    // الحالة 1: ملف صغير (جزء واحد) — حفظ مباشر
    // =====================================================
    if (totalChunks === 1) {
      var mediaId = await mediaInsert(fileName, filePath, fileType, buffer.length, base64, category)
      return NextResponse.json({
        filePath: '/api/files/' + mediaId,
        fileType: fileType,
        filename: fileName,
        size: buffer.length,
        done: true,
      })
    }

    // =====================================================
    // الحالة 2: رفع مجزأ — تخزين مؤقت للجزء الحالي
    // =====================================================
    if (!uploadId) {
      return NextResponse.json({ error: 'uploadId مفقود للرفع المجزأ' }, { status: 400 })
    }

    await cleanupOrphanChunks()

    var slotPath = chunkSlotPath(uploadId, chunkIndex)
    try { await db.$executeRawUnsafe('DELETE FROM Media WHERE filePath = ?', slotPath) } catch (e) {}
    await mediaInsert(fileName, slotPath, fileType, buffer.length, base64, '__chunk__')

    if (chunkIndex < totalChunks - 1) {
      return NextResponse.json({
        done: false,
        chunkIndex: chunkIndex,
        totalChunks: totalChunks,
        received: buffer.length,
      })
    }

    // =====================================================
    // الحالة 3: آخر جزء وصل — تجميع كل الأجزاء بالترتيب
    // =====================================================
    var parts: any[] = (await db.$queryRawUnsafe(
      'SELECT id, filePath, data, createdAt FROM Media WHERE filePath LIKE ? ORDER BY createdAt ASC',
      CHUNK_PREFIX + uploadId + '/%'
    )) || []

    parts.sort(function (a: any, b: any) {
      var pa = Array.isArray(a) ? a[1] : a.filePath
      var pb = Array.isArray(b) ? b[1] : b.filePath
      return parseIndexFromPath(String(pa)) - parseIndexFromPath(String(pb))
    })

    if (parts.length < totalChunks) {
      return NextResponse.json(
        {
          error: 'اتستلم ' + parts.length + ' جزء من ' + totalChunks + ' — حاول ترفع الملف تاني',
          received: parts.length,
          totalChunks: totalChunks,
        },
        { status: 400 }
      )
    }

    var buffers: Buffer[] = []
    var totalSize = 0
    for (var i = 0; i < totalChunks; i++) {
      var p = parts[i]
      var chunkData = String((Array.isArray(p) ? p[2] : p.data) || '')
      var chunkBuf = Buffer.from(chunkData, 'base64')
      buffers.push(chunkBuf)
      totalSize += chunkBuf.length
    }
    var full = Buffer.concat(buffers)
    var fullBase64 = full.toString('base64')

    var finalId = await mediaInsert(fileName, filePath, fileType, totalSize, fullBase64, category)
    await mediaDeleteByPathPrefix(CHUNK_PREFIX + uploadId + '/')

    return NextResponse.json({
      filePath: '/api/files/' + finalId,
      fileType: fileType,
      filename: fileName,
      size: totalSize,
      done: true,
    })
  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'حصلت مشكلة في الرفع' }, { status: 500 })
  }
}
