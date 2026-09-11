import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// لوحة شرف المنصة — عامة لكل الزوار من غير تسجيل دخول (2026-و18/18-d)
// طلب المستر: «الصفحة الرئيسية خالص تظهر ترتيب أول 3 طلاب من حيث
// عدد النقاط اللي معاهم».
// النقاط = مجموع درجات تسليمات الامتحانات (ExamResult.score)
//        + مجموع درجات تسليمات الواجبات (HomeworkResult.score)
// والطلاب المقبولين/النشطين بس — ومفيش أي بيانات حساسة هنا:
// الاسم كامل زي ما الطالب كاتبه + الصف + النقاط. ممنوع التليفون والإيميل.
// (و21: تعديل بطلب المستر — الاسم كامل مش كلمتين)
// ملاحظة: حذف أي امتحان/واجب بيمسح نتايجه فنقاطه بتقع تلقائيًا
// لأن الترتيب محسوب من صفوف النتايج نفسها.
// ============================================================

// طالب نشط = مقبول أو مدفوع أو active — نفس تعريف video-guard
var ACTIVE_STATUSES = ['approved', 'paid', 'active']

// الاسم كامل زي ما الطالب كاتبه في العرض العام (و21 بطلب المستر — بدل كلمتين)
function shortName(fullName: unknown): string {
  return String(fullName || '').trim().replace(/\s+/g, ' ')
}

// تقريب النقاط لآخر منزلتين عشان مايطلعوش كسور عشرية طويلة من الـ Float
function cleanPoints(n: unknown): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

// صياغة عربية سليمة لعدد النقاط
function pointsLabel(n: number): string {
  if (n === 1) return 'نقطة واحدة'
  if (n === 2) return 'نقطتان'
  if (n >= 3 && n <= 10) return String(n) + ' نقاط'
  return String(n) + ' نقطة'
}

export async function GET() {
  try {
    // 1) مجموع درجات الامتحانات لكل طالب — Prisma أولاً وraw SQL احتياطي
    //    (داتابيز إنتاج اتعملت بـ raw SQL فممكن شكل الجدول يختلف شوية)
    var examTotals: Record<string, number> = {}
    var hwTotals: Record<string, number> = {}

    try {
      var examAgg = await db.examResult.groupBy({
        by: ['studentId'],
        _sum: { score: true },
      })
      examAgg.forEach(function (row: { studentId: string; _sum: { score: number | null } }) {
        examTotals[row.studentId] = cleanPoints(row._sum.score)
      })
    } catch (e) {
      try {
        var examRows: any[] = (await db.$queryRawUnsafe(
          'SELECT studentId, SUM(score) AS total FROM ExamResult GROUP BY studentId'
        )) as any[]
        ;(examRows || []).forEach(function (r: any) {
          examTotals[String(r.studentId)] = cleanPoints(r.total)
        })
      } catch (e2) {}
    }

    // 2) مجموع درجات الواجبات لكل طالب — نفس النمط
    try {
      var hwAgg = await db.homeworkResult.groupBy({
        by: ['studentId'],
        _sum: { score: true },
      })
      hwAgg.forEach(function (row: { studentId: string; _sum: { score: number | null } }) {
        hwTotals[row.studentId] = cleanPoints(row._sum.score)
      })
    } catch (e) {
      try {
        var hwRows: any[] = (await db.$queryRawUnsafe(
          'SELECT studentId, SUM(score) AS total FROM HomeworkResult GROUP BY studentId'
        )) as any[]
        ;(hwRows || []).forEach(function (r: any) {
          hwTotals[String(r.studentId)] = cleanPoints(r.total)
        })
      } catch (e2) {}
    }

    // 3) الطلاب المقبولين/النشطين بس — وبكده أي نتيجة لطالب اتحذف حسابه
    //    (صف يتيم) بتتسقط تلقائيًا لأنها مش هتلاقي الطالب في القايمة دي
    var students = await db.student.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: { id: true, name: true, grade: true },
    })

    // 4) النقاط الكلية = امتحانات + واجبات، والترتيب تنازلي وآخر 3 بس
    var board = students
      .map(function (s: { id: string; name: string; grade: string }) {
        return {
          id: s.id,
          name: shortName(s.name),
          grade: String(s.grade || ''),
          points: cleanPoints((examTotals[s.id] || 0) + (hwTotals[s.id] || 0)),
        }
      })
      .filter(function (s) {
        return s.points > 0
      })
      .sort(function (a, b) {
        return b.points - a.points
      })
      .slice(0, 3)
      .map(function (s, i) {
        return {
          rank: i + 1,
          name: s.name,
          grade: s.grade,
          points: s.points,
          pointsLabel: pointsLabel(s.points),
        }
      })

    return NextResponse.json({ leaderboard: board })
  } catch (error) {
    console.error('Leaderboard error:', error)
    // القايمة عامة على الصفحة الرئيسية — فشلها ميرميش الصفحة، بترجع فاضية
    return NextResponse.json({ leaderboard: [] })
  }
}
