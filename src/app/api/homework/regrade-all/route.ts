// @ts-nocheck
// POST /api/homework/regrade-all
// PURPOSE: زرار المستر — إعادة تصحيح **كل** تسليمات واجب معين بالذكاء الاصطناعي
//   (التسليمات القديمة المخزنة بصدام الكود القديم كانت فضلت غلط للأبد —
//    الـ sweep القديم بيستهدف المعلق بس، وده بيصحح الكل حتي المصحح غلط)
//   1. بيجيب كل HomeworkResult للواجب ORDER BY submittedAt ASC (raw SQL زي باقي المسارات)
//   2. بيعيد تصحيح أول batch بحجم limit (افتراضي 6، أقصى 12) عبر regradeHomeworkResult
//   3. بيرجّع { success, fixed, remaining, total } — العميل يلوب لحد ما remaining === 0
// Input: { homeworkId: string, limit?: number, skip?: number }
//   skip = إزاحة داخل القايمة (العميل بيزيدها بحجم الـ batch اللي اتعالج) عشان
//   كل نداء يكمّل من عند اللي فات من غير حالة على السيرفر (serverless-safe)
// Output: { success: true, fixed: <عدد اللي اتصححوا>, processed: <حجم الدفعة>, remaining: <الباقي>, total: <الكل> }

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { regradeHomeworkResult } from '@/lib/regrade-core'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    var body = await request.json()
    var homeworkId = body.homeworkId
    if (!homeworkId) {
      return NextResponse.json({ error: 'مفيش homeworkId' }, { status: 400 })
    }

    var limit = Math.min(Math.max(Math.round(Number(body.limit) || 6), 1), 12)
    var skip = Math.max(Math.round(Number(body.skip) || 0), 0)

    // الواجب موجود؟
    try {
      var hwRows: any[] = await db.$queryRawUnsafe('SELECT id FROM Homework WHERE id = ? LIMIT 1', homeworkId)
      if (!hwRows || hwRows.length === 0) {
        return NextResponse.json({ error: 'الواجب غير موجود' }, { status: 404 })
      }
    } catch (e) {}

    // القايمة كلها بالترتيب الأقدم الأول (نفس أسلوب قراية النتايج في regrade-core)
    var rows: any[] = []
    try {
      rows = await db.$queryRawUnsafe(
        'SELECT id, submittedAt FROM HomeworkResult WHERE homeworkId = ? ORDER BY submittedAt ASC',
        homeworkId
      )
    } catch (e) {
      rows = []
    }
    var total = Array.isArray(rows) ? rows.length : 0
    if (total === 0) {
      return NextResponse.json({ success: true, fixed: 0, processed: 0, remaining: 0, total: 0 })
    }

    if (skip >= total) {
      return NextResponse.json({ success: true, fixed: 0, processed: 0, remaining: 0, total: total })
    }

    var batch = rows.slice(skip, skip + limit)
    var fixed = 0
    for (var i = 0; i < batch.length; i++) {
      try {
        var outcome = await regradeHomeworkResult(batch[i].id)
        if (outcome) fixed++
      } catch (err) {
        console.error('[homework/regrade-all] regrade error for', batch[i].id, err)
      }
    }

    var processed = batch.length
    var remaining = Math.max(0, total - (skip + processed))

    return NextResponse.json({
      success: true,
      fixed: fixed,
      processed: processed,
      remaining: remaining,
      total: total,
    })
  } catch (error) {
    console.error('Homework regrade-all error:', error)
    return NextResponse.json({ error: 'Error: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
