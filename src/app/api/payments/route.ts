import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

// POST - Student submits a payment/activation request
/* 2026-و25 — حذف تخزين الإيصالات نهائيًا (نقل من maths-genius — طلب المستر:
   «بتاع الإقرار بتاع الـ PDF ده طباعة الإيصال هياخد من مساحة قاعدة البيانات، فشكله ملوش لزوم»):
   - مفيش ملف إيصال بيتخزن خالص (كان بيتحفظ base64 في جدول Media = مساحة قاعدة بيانات)
   - الطلب بقى نص بس (طريقة دفع + مرجع عملية اختياري)
   - إيصالات قديمة متسجلة في قاعدة البيانات فضلت زي ما هي والأدمن لسه يشوفها من PaymentsPanel
   - قبول JSON (صفحة /payment العامة) و FormData (البورتال) مع بعض — كان فيه باج قديم:
     صفحة الدفع العامة بتبعت JSON والـ API بيقرأ formData فيرجع 500 */
export async function POST(request: NextRequest) {
  try {
    var videoId = '', videoTitle = '', paymentMethod = '', notes = '', studentId = '', studentName = ''
    var amount = 0
    var contentType = request.headers.get('content-type') || ''
    if (contentType.indexOf('application/json') !== -1) {
      var body = await request.json()
      videoId = String(body.videoId || '')
      videoTitle = String(body.videoTitle || '')
      amount = Number(body.amount) || 0
      paymentMethod = String(body.method || body.paymentMethod || '')
      notes = String(body.note || body.notes || '')
      studentId = String(body.studentId || '')
      studentName = String(body.studentName || '')
    } else {
      var formData = await request.formData()
      videoId = String(formData.get('videoId') || '')
      videoTitle = String(formData.get('videoTitle') || '')
      amount = parseFloat(String(formData.get('amount') || '0')) || 0
      paymentMethod = String(formData.get('paymentMethod') || '')
      notes = String(formData.get('notes') || formData.get('note') || '')
      studentId = String(formData.get('studentId') || '')
      studentName = String(formData.get('studentName') || '')
    }

    if (!videoId || !paymentMethod) {
      return NextResponse.json({ error: 'videoId and paymentMethod are required' }, { status: 400 })
    }

    // مفيش تخزين إيصالات خالص — receiptPath فاضي دايمًا (توفير مساحة قاعدة البيانات)
    var receiptPath = ''

    var payment = await db.payment.create({
      data: {
        studentId,
        studentName,
        videoId,
        videoTitle,
        amount,
        method: paymentMethod,
        receiptPath,
        note: notes,
        status: 'pending',
      },
    })

    return NextResponse.json({ message: 'Payment submitted', payment }, { status: 201 })
  } catch (error: any) {
    console.error('Payment submit error:', error)
    return NextResponse.json({ error: 'Server error: ' + (error.message || String(error)) }, { status: 500 })
  }
}

// GET - List payments (admin or student)
export async function GET(request: NextRequest) {
  try {
    var url = new URL(request.url)
    var status = url.searchParams.get('status') || ''
    var studentId = url.searchParams.get('studentId') || ''
    var pageSize = parseInt(url.searchParams.get('pageSize') || '100')

    var where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }
    if (studentId) {
      where.studentId = studentId
    }

    var payments = await db.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
    })

    var counts = await db.payment.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    var countMap: Record<string, number> = {}
    for (var c of counts) {
      countMap[c.status] = c._count.status
    }

    return NextResponse.json({
      payments,
      counts: {
        total: countMap['pending'] + (countMap['approved'] || 0) + (countMap['rejected'] || 0),
        pending: countMap['pending'] || 0,
        approved: countMap['approved'] || 0,
        rejected: countMap['rejected'] || 0,
      },
    })
  } catch (error: any) {
    console.error('Payments list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
