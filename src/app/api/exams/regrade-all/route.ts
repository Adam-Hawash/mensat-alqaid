// @ts-nocheck
// POST /api/exams/regrade-all
// PURPOSE: زرار المستر — إعادة تصحيح **كل** تسليمات امتحان معين بالذكاء الاصطناعي
//   (النتايج القديمة المخزنة كانت فضلت غلط للأبد — وده بيعيد التصحيح على
//    أسئلة نموذج الطالب الحقيقية عبر regradeExamResult من regrade-core)
//   1. بيجيب كل ExamResult للامتحان ORDER BY submittedAt ASC (raw SQL زي باقي المسارات)
//   2. بيعيد تصحيح أول batch بحجم limit (افتراضي 6، أقصى 12)
//   3. بيرجّع { success, fixed, remaining, total } — العميل يلوب لحد ما remaining === 0
// Input: { examId: string, limit?: number, skip?: number }
//   skip = إزاحة داخل القايمة (العميل بيزيدها بحجم الـ batch اللي اتعالج)
// Output: { success: true, fixed: <عدد اللي اتصححوا>, processed: <حجم الدفعة>, remaining: <الباقي>, total: <الكل> }

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { regradeExamResult } from '@/lib/regrade-core'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    var body = await request.json()
    var examId = body.examId
    if (!examId) {
      return NextResponse.json({ error: 'مفيش examId' }, { status: 400 })
    }

    var limit = Math.min(Math.max(Math.round(Number(body.limit) || 6), 1), 12)
    var skip = Math.max(Math.round(Number(body.skip) || 0), 0)

    // الامتحان موجود؟
    try {
      var examRows: any[] = await db.$queryRawUnsafe('SELECT id FROM Exam WHERE id = ? LIMIT 1', examId)
      if (!examRows || examRows.length === 0) {
        return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 })
      }
    } catch (e) {}

    // القايمة كلها بالترتيب الأقدم الأول
    var rows: any[] = []
    try {
      rows = await db.$queryRawUnsafe(
        'SELECT id, submittedAt FROM ExamResult WHERE examId = ? ORDER BY submittedAt ASC',
        examId
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
        var outcome = await regradeExamResult(batch[i].id)
        if (outcome) fixed++
      } catch (err) {
        console.error('[exams/regrade-all] regrade error for', batch[i].id, err)
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
    console.error('Exam regrade-all error:', error)
    return NextResponse.json({ error: 'Error: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
