
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { studentName, studentPhone, studentGrade, parentName, parentPhone } = body

    const resendApiKey = process.env.RESEND_API_KEY
    const adminEmail = process.env.ADMIN_EMAIL || 'adam7awash@gmail.com'

    if (!resendApiKey) {
      console.log('RESEND_API_KEY not set — skipping admin notification email')
      return NextResponse.json({ message: 'Skipped (no API key)' })
    }

    const resend = new Resend(resendApiKey)

    const parentInfo = parentName ? `
              <p style="margin: 8px 0;"><strong>اسم ولي الأمر:</strong> ${parentName}</p>
              <p style="margin: 8px 0;"><strong>هاتف ولي الأمر:</strong> ${parentPhone || '—'}</p>` : ''

    await resend.emails.send({
      from: 'منصة القائد <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `طالب جديد مسجّل: ${studentName} — منصة القائد`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <div style="background: #0C1220; border-radius: 12px; padding: 24px; color: #F0FDFA;">
            <h1 style="margin: 0 0 8px 0; color: #2DD4BF;">منصة القائد</h1>
            <p style="color: #8C9DAF; margin: 0 0 20px 0;">إشعار تسجيل طالب جديد</p>
            <div style="background: #1A2A3A; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <p style="margin: 8px 0;"><strong>اسم الطالب:</strong> ${studentName}</p>
              <p style="margin: 8px 0;"><strong>رقم الهاتف:</strong> ${studentPhone}</p>
              <p style="margin: 8px 0;"><strong>الصف:</strong> ${studentGrade}</p>
              ${parentInfo}
            </div>
            <p style="color: #8C9DAF; font-size: 13px;">يرجى تسجيل الدخول للوحة التحكم لقبول أو رفض هذا الطلب.</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ message: 'Admin notified' })
  } catch (error) {
    console.error('Notify admin error:', error)
    return NextResponse.json({ error: 'Failed to notify admin' }, { status: 500 })
  }
}
