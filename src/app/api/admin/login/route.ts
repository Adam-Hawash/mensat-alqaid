// @ts-nocheck
import { NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'

export var maxDuration = 10

var DEFAULT_EMAIL = 'mr.amr history'
var DEFAULT_PASSWORD = 'Abohabiba2026'
var LEGACY_PASSWORD = 'Abo habiba2026'
var ADMIN_NAME = 'مستر عمرو رشدي'

export async function POST(request) {
  var body
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  var email = body.email
  var password = body.password

  if (!email || !password) {
    return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبين' }, { status: 400 })
  }

  var cleanEmail = email.trim().toLowerCase()
  var cleanPassword = password

  try {
    var admin = await db.admin.findFirst()

    if (!admin) {
      if (cleanEmail !== DEFAULT_EMAIL || (cleanPassword !== DEFAULT_PASSWORD && cleanPassword !== LEGACY_PASSWORD)) {
        return NextResponse.json({ error: 'البريد أو كلمة المرور غلط' }, { status: 401 })
      }
      admin = await safeWrite(function() {
        return db.admin.create({
          data: { email: DEFAULT_EMAIL, password: DEFAULT_PASSWORD, name: ADMIN_NAME },
        })
      })
    } else {
      // Check stored credentials OR default fallback credentials
      var matchStored = (cleanEmail === admin.email && cleanPassword === admin.password)
      var matchDefault = (cleanEmail === DEFAULT_EMAIL && (cleanPassword === DEFAULT_PASSWORD || cleanPassword === LEGACY_PASSWORD))
      if (!matchStored && !matchDefault) {
        return NextResponse.json({ error: 'البريد أو كلمة المرور غلط' }, { status: 401 })
      }
      // If default credentials used and differ from stored, update them
      if (matchDefault && !matchStored) {
        admin = await safeWrite(function() {
          return db.admin.update({
            where: { id: admin.id },
            data: { email: DEFAULT_EMAIL, password: DEFAULT_PASSWORD },
          })
        })
      }
    }

    var adminWithoutPassword = { id: admin.id, email: admin.email, name: admin.name, createdAt: admin.createdAt, updatedAt: admin.updatedAt }

    return NextResponse.json({
      message: 'تم تسجيل الدخول',
      admin: adminWithoutPassword,
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json({ error: 'خطأ في السيرفر' }, { status: 500 })
  }
}
