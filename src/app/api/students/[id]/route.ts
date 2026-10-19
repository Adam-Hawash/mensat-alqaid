
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { storeGrade } from '@/lib/grade-names' // (S-4b توحيد الصفوف)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const student = await db.student.findUnique({
      where: { id },
      include: {
        _count: { select: { activities: true } },
        activities: {
          where: { action: 'watched_video' },
          select: { details: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    return NextResponse.json({ student })
  } catch (error) {
    console.error('Student detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, phone, grade, status, isPaidAccess } = body

    const existing = await db.student.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const updateData: Record<string, any> = {}
    if (name) updateData.name = name
    if (phone) updateData.phone = phone
    if (grade) updateData.grade = storeGrade(grade) // (S-4b) بالاسم المعتمد
    if (status) updateData.status = status
    if (typeof isPaidAccess === 'boolean') updateData.isPaidAccess = isPaidAccess
    // ===== ربط الجهاز: تحكم المستر =====
    // allowAllDevices: سماح لمرة واحدة — أول جهاز يدخل بعدها بيبقى جهاز الحساب
    // والسماح بيتقفل لوحده (شوف منطق الدخول في /api/students)
    if (typeof body.allowAllDevices === 'boolean') updateData.allowAllDevices = body.allowAllDevices
    // resetDevice: فك الربط الكامل (الزرار الوحيد للمستر) — أول جهاز يسجل
    // دخول بعد كده بيبقى هو جهاز الحساب الجديد **للأبد**
    if (body.resetDevice === true) {
      updateData.deviceId = ''
      updateData.deviceFp = ''
      updateData.deviceTraits = ''
      updateData.creationDeviceId = ''
      updateData.creationDeviceFp = ''
    }
    // bindDevice: ربط الحساب بجهاز محدد يدويًا (زرار "اربط جهازي الحالي" في
    // لوحة التحكم — بيربط الجهاز اللي المستر واقف عليه دلوقتي **بكل بياناته**:
    // الهوية الفريدة + البصمة + مكوّنات الجهاز + النوع — عشان أول دخول بعدها
    // يطابق مباشرة من غير أي مساومة)
    // **مهم**: الدخول بيفحص أعمدة الإنشاء الثابتة الأول — فالربط اليدوي لازم
    // يتكتب هناك كمان وإلا الجهاز المربوط يدويًا هيفضل مرفوض 403!
    if (typeof body.bindDevice === 'string' && body.bindDevice) {
      updateData.deviceId = body.bindDevice
      updateData.creationDeviceId = body.bindDevice
      if (typeof body.bindDeviceFp === 'string' && body.bindDeviceFp) {
        updateData.deviceFp = body.bindDeviceFp
        updateData.creationDeviceFp = body.bindDeviceFp
      }
      if (typeof body.bindDeviceTraits === 'string' && body.bindDeviceTraits.length <= 4000) {
        updateData.deviceTraits = body.bindDeviceTraits
      }
      if (typeof body.bindDeviceType === 'string' && ['mobile', 'tablet', 'computer'].indexOf(body.bindDeviceType) !== -1) {
        updateData.deviceType = body.bindDeviceType
      }
      // أي ربط يدوي بيلغي السماح المفتوح (الربط بقى محدد بدقة)
      if (existing.allowAllDevices === true) updateData.allowAllDevices = false
    }

    const student = await db.student.update({
      where: { id },
      data: updateData,
    })

    // Record status change activity
    if (status && status !== existing.status) {
      await db.studentActivity.create({
        data: { studentId: id, action: 'status_changed_to_' + status, details: 'Status changed from ' + existing.status + ' to ' + status },
      })
    }

    // Record device actions (للمستر يقدر يتتبع مين ااتربط وإمتى)
    if (updateData.creationDeviceId && updateData.creationDeviceId !== existing.creationDeviceId) {
      try {
        await db.studentActivity.create({
          data: { studentId: id, action: 'device_manual_bind', details: 'المستر ربط الحساب يدويًا بجهاز جديد من لوحة التحكم — الجهاز ده بقى جهاز الحساب' },
        })
      } catch (e) {}
    } else if (body.resetDevice === true) {
      try {
        await db.studentActivity.create({
          data: { studentId: id, action: 'device_unlinked', details: 'المستر فك ربط الجهاز — أول جهاز يسجل دخول بعد كده هيبقى هو جهاز الحساب' },
        })
      } catch (e) {}
    }

    return NextResponse.json({ message: 'Student updated', student })
  } catch (error) {
    console.error('Student update error:', error)
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await db.student.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    /* (ز19) حذف نهائي متسلسل — الطالب بيتمسح بكل صفوفه عشان ما يفضلش
       أي أثر ليه في قاعدة البيانات (بدل ما يبقى بس «مقفول/مرفوض»).
       الفورين كيز مش مفعّلة على داتابيز الإنتاج (SQLite) فبنمسح يدويًا
       من كل جدول مرتبط بـ studentId — كل جدول في try/catch لوحده عشان
       فشل جدول واحد ما يمنعش باقي التنضيف ولا حذف الطالب نفسه. */
    var studentCascadeTables = [
      'StudentActivity', 'ExamResult', 'HomeworkResult', 'VideoProgress',
      'VideoAccess', 'PlayTicket', 'Payment', 'Discussion', 'Complaint',
      'Notification',
    ]
    for (var t = 0; t < studentCascadeTables.length; t++) {
      try {
        await db.$executeRawUnsafe('DELETE FROM ' + studentCascadeTables[t] + ' WHERE studentId = ?', id)
      } catch (e) {
        console.error('Student cascade cleanup (' + studentCascadeTables[t] + '):', e)
      }
    }
    /* روابط الأبوة ParentStudent (جدول raw لو موجود) — احتياطي */
    try { await db.$executeRawUnsafe('DELETE FROM ParentStudent WHERE studentId = ?', id) } catch (e) {}
    try { await db.$executeRawUnsafe('DELETE FROM ParentStudent WHERE parentId IN (SELECT id FROM Parent WHERE studentId = ?)', id) } catch (e) {}

    /* حسابات أولياء الأمور المرتبطة بالطالب + أجهزة Web Push بتاعتهم —
       عشان ما يفضلش حسابات أب يتيمة على ابن اتمسح */
    var parentIds: string[] = []
    try {
      var pRows: any[] = await db.$queryRawUnsafe('SELECT id FROM Parent WHERE studentId = ?', id)
      parentIds = (pRows || []).map(function (r: any) { return String(r.id) }).filter(Boolean)
    } catch (e) {
      console.error('Student cascade Parent lookup:', e)
    }
    if (parentIds.length > 0) {
      var ph = parentIds.map(function () { return '?' }).join(',')
      try { await db.$executeRawUnsafe.apply(db, ['DELETE FROM ParentPushSubscription WHERE parentId IN (' + ph + ')'].concat(parentIds)) } catch (e) {
        console.error('Student cascade ParentPushSubscription:', e)
      }
    }
    try { await db.$executeRawUnsafe('DELETE FROM Parent WHERE studentId = ?', id) } catch (e) {
      console.error('Student cascade Parent:', e)
    }

    await db.student.delete({ where: { id } })

    return NextResponse.json({ message: 'Student deleted' })
  } catch (error) {
    console.error('Student delete error:', error)
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
  }
}
