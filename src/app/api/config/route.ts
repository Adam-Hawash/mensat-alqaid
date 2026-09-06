// @ts-nocheck
import { NextResponse } from 'next/server'
import { db, safeWrite } from '@/lib/db'

// NOTE: هذه القيم منسوخة من قاعدة البيانات الحية (mensat-alqaid.vercel.app) بتاريخ اليوم،
// عشان لو قاعدة البيانات اتغيرت أو اتمسحت، المنصة تفضل شاكلة بنفس النصوص.
var DEFAULTS = {
  // === Navbar ===
  navbar_brand: "منصة القائد",
  navbar_subtitle: "مستر عمرو رشدي",

  // === Hero Section ===
  hero_badge: "منصة تعليمية متكاملة |",
  hero_title_line1: "منصة القائد",
  hero_title_line2: "مستر عمرو رشدي",
  hero_subtitle: "انسى التعقيد والحفظ الكتير! هنخلي الدراسات والتاريخ لعبة في ايدك.. امتحانات دورية، متابعة أسبوعية، وشغل عالي يضمن لك التفوق من غير إرهاق",
  hero_bg_image: "https://i.imghos.co/BouWnlLk.png",
  hero_stat1_value: "8+",
  hero_stat1_label: "المراحل الدراسية",
  hero_stat2_value: "100+",
  hero_stat2_label: "دروس فيديو",
  hero_stat3_value: "24/7",
  hero_stat3_label: "متابعة التقدم",
  hero_developer_url: "https://prime-developer-portfolio-11.vercel.app/",
  hero_developer_label: "Prime Developer",
  footer_made_by_label: "Developed by Adam Hawash",

  // === Instructor ===
  instructor_name: "مستر عمرو رشدي",
  instructor_title: " مدرس الدراسات والتاريخ المتخصص",
  instructor_photo: "https://i.imghos.co/eFWwuOqW.png",

  // === Features Section ===
  features_title: "ليه تختارنا؟",
  features_subtitle: "بنقدملك تجربة تعليمية مش هتلاقي زيها، بتجمع بين الشرح المبسط والتطبيق العملي اللي بيخلي التاريخ والجغرافيا أسهل ما يكون.",
  feature1_title: "شرح مبسط",
  feature1_desc: "شرح وافي وبسيط لكل درس في الدراسات والتاريخ عشان تفهم بعمق وتستوعب الأحداث التاريخية والجغرافية بسرعة ",
  feature2_title: "فهم حقيقي مش حفظ",
  feature2_desc: "بنركز إنك تفهم مش تحفظ وخلاص، عشان تبني جوّاك قدرة حقيقية على تحليل أي حدث تاريخي أو جغرافي بكل سهولة",
  feature3_title: "خرائط ذهنية وزمنية",
  feature3_desc: "تحليل خطوة بخطوة للأحداث التاريخية المعقدة مع خرائط زمنية وملخصات بصرية تسهل الفهم والتذكر.",
  feature4_title: "مراجعات وامتحانات",
  feature4_desc: "تحضير شامل ومراجعات دورية واختبارات أسبوعية لضمان التفوق والاستعداد الكامل للامتحانات النهائية",

  // === Grades Section ===
  grades_title: "السنوات الدراسية",
  grades_subtitle: "كل مرحلة دراسية وليها نظامها وشرحها الخاص اللي يناسبها.. اختار مرحلتك واعرف كل التفاصيل والدروس المتاحة ليك",

  // === Guide Section ===
  guide_badge: "دليلك التعليمي | Learning Guide",
  guide_title: "ازاي تستخدم المنصة؟",
  guide_subtitle: "خطوات بسيطة تبدأ بيها رحلتك التعليمية في منصة القائد عشان توصل للتفوق.",
  guide_card1_title: "سجل حسابك",
  guide_card1_title_en: "",
  guide_card1_desc: "أنشئ حسابك في المنصة بسرعة وسهولة، واختار صفك الدراسي وابدأ رحلتك فوراً",
  guide_card2_title: "مشاهدة الدروس",
  guide_card2_title_en: "اتفرج على الدروس",
  guide_card2_desc: "تابع شروحات مبسطة ومتسلسلة لكل درس في الدراسات والتاريخ بأسلوب تفاعلي يخلي الفهم لعبة في إيدك",
  guide_card3_title: "حل الواجبات",
  guide_card3_title_en: "",
  guide_card3_desc: "خلّي إيدك في المادة على طول.. أكمل واجباتك الأسبوعية وحل الأسئلة والتدريبات عشان تثبت المعلومات",
  guide_card4_title: "أداء الامتحانات",
  guide_card4_title_en: "",
  guide_card4_desc: "امتحن أول بأول.. شارك في الامتحانات الدورية لمتابعة مستواك والاستعداد الكامل للامتحانات النهائية من غير أي قلق.",
  guide_card5_title: "بطاقات تعليمية",
  guide_card5_title_en: "",
  guide_card5_desc: "استخدم البطاقات التعليمية السريعة لمراجعة المصطلحات المهمة وتواريخ الأحداث التاريخية بشكل سريع وخفيف.",
  guide_card6_title: "تحديات ومسابقات",
  guide_card6_title_en: "",
  guide_card6_desc: "اختبر نفسك ونافس زمايلك في مسابقات وتحديات تفاعلية تخلي المادة ممتعة وتثبت في دماغك أكتر.",

  // === Tips Section ===
  tips_badge: "نصائح للتفوّق",
  tips_title: "نصائح مستر عمرو",
  tips_subtitle: "نصائح ذهبية من مستر عمرو رشدي للتفوّق في الدراسات والتاريخ",
  tips_bg_image: "https://i.imghos.co/uSMAOlwr.png",
  tips_section_image: "https://i.imghos.co/uSMAOlwr.png",
  tips_card1_title: "ركز على الفهم مش الحفظ",
  tips_card1_title_en: "",
  tips_card1_desc: "افهم الحدث التاريخي أو الظاهرة الجغرافية حصلت ليه وإزاي، مش مجرد تكرار كلام وخلاص. الفهم العميق بيخلي المعلومة تلزق في دماغك لأطول فترة وتعرف تجاوب أي سؤال بذكاء.",
  tips_card2_title: "اربط الأحداث ببعضها",
  tips_card2_title_en: "",
  tips_card2_desc: "التاريخ مش تواريخ صماء ورص كلام وخلاص.. اربط كل حدث باللي قبله وبالعصر بتاعها عشان القصة تدخل دماغك وتفهمها كأنها فيلم قدامك.",
  tips_card3_title: "ركز على الخرائط والرسومات",
  tips_card3_title_en: "",
  tips_card3_desc: "الجغرافيا والدراسات ما ينفعش تتفهم من غير ما تبص على الخريطة وتتخيل المكان بنفسك؛ البصريات دي بتخلي المعلومة تثبت في الدماغ للآخر.",
  tips_card4_title: "اسأل وما تترددش",
  tips_card4_title_en: "",
  tips_card4_desc: "لو في حدث مش فاهمه أو جزئية واقفة معاك في المنهج، اسأل فوراً وما تتكسفش.. السؤال هو أول طريق الفهم الصح والتثبيت.",

  // === Gallery ===
  gallery_title: "صور طلابي الأعزاء | My Beloved Students",
  gallery_subtitle: "لحظات مميزة من رحلتنا التعليمية — Moments from our educational journey",

  // === Social Links ===
  social_facebook: "",
  social_whatsapp_channel: "",
  social_instagram: "",
  social_youtube: "",

  // === WhatsApp Button ===
  whatsapp_number: "01004753349",

  // === Footer ===
  footer_brand: "منصة القائد",
  footer_copyright: "جميع الحقوق محفوظة لـ مستر عمرو رشدي",

  // === Branding & Favicon ===
  site_logo: "https://i.imghos.co/BouWnlLk.png",
  favicon_url: "",

  // === API Keys ===
  resend_api_key: "",

  // === Payment Numbers (shown to students) ===
  payment_vodafone_cash: "",
  payment_instapay: "",
  payment_fawry: "",

}

export async function GET() {
  try {
    var configs = await db.siteConfig.findMany()
    var map = Object.assign({}, DEFAULTS)
    for (var i = 0; i < configs.length; i++) {
      var c = configs[i]
      map[c.key] = c.value
    }
    return NextResponse.json(map)
  } catch (error) {
    console.error('Config fetch error:', error)
    // CRITICAL FIX: Return flat DEFAULTS so frontend never crashes
    return NextResponse.json(Object.assign({}, DEFAULTS))
  }
}

export async function PUT(request) {
  try {
    var body = await request.json()
    var keys = Object.keys(body)

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      var value = body[key]
      // Skip non-config keys that might come from error responses
      if (key === 'error' || key === 'defaults') continue
      await safeWrite(function(k, v) {
        return function() {
          return db.siteConfig.upsert({
            where: { key: k },
            update: { value: v, updatedAt: new Date() },
            create: { key: k, value: v },
          })
        }
      }(key, value))
    }

    return NextResponse.json({ message: 'Config updated' })
  } catch (error) {
    console.error('Config update error:', error)
    return NextResponse.json({ error: 'Failed to update config', detail: error.message, code: error.code }, { status: 500 })
  }
}
