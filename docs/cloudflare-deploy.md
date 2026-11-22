# دليل النشر على Cloudflare Workers (منصة مستر وائل)

## الملفات المضافة/المعدلة ووظيفة كل واحدة

| الملف | الوظيفة |
|---|---|
| `wrangler.jsonc` | ملف إعداد Wrangler (كلاود فلير): بيحدد اسم الـ Worker (`mensat-alqaid`)، ونقطة الدخول `.open-next/worker.js` الناتجة من OpenNext، وربط ملفات الأستاتيك `.open-next/assets` بالـ binding `ASSETS`، وتاريخ التوافق `2026-11-01` مع فлаг `nodejs_compat` لتشغيل كود Node داخل Workers، وتفعيل الـ Observability للمراقبة واللوجات. |
| `open-next.config.ts` | ملف إعداد OpenNext: بيحوّل ناتج `next build` لـ Worker متوافق مع كلاود فلير (فلنكشن افتراضي بدون إضافات). |
| `.npmrc` | سطر واحد `legacy-peer-deps=true` — لأن بناء كلاود فلير بيستخدم npm الصارم، و`@opennextjs/cloudflare` بيتخاصم مع `next 16.3.1` في الـ peer deps، فالسطر ده بيمنع فشل التثبيت. |
| `.gitignore` | اتضاف سطرين `.open-next/` و `.wrangler/` عشان نتجاهل مخرجات البناء المحلية (حجمها كبير ومش المفروض تترفع للـ Git). |
| `package.json` | اتضاف 3 سكربتات جديدة: `build:cf` (بناء للكلاود)، `preview:cf` (معاينة محلية بنفس بيئة الـ Worker)، `deploy:cf` (نشر مباشر)، + المكتبة `@opennextjs/cloudflare@1.20.18` في `devDependencies`. |
| `next.config.ts` | اتضاف في `serverExternalPackages`: `@prisma/client` و `@prisma/engines` و `@napi-rs/canvas` و `pdfjs-dist` (عشان تتفضل خارجية وتتلف مع الحزمة)، + كتلة `outputFileTracingIncludes` لـ `/api/**` بتضمن ملفات برisma (الـ engines) و pdfjs و canvas جوه الناتج النهائي. |

## خطوات النشر

1. ارفع الكود لمستودع Git (GitHub مثلاً).
2. افتح **Cloudflare Dashboard → Workers & Pages → Create → Workers**.
3. اختار **Connect to Git** واسمح لكلاود فلير يوصل بالمستودع، وبعدين اختار المستودع بتاع المنصة.
4. في إعدادات البناء اكتب:
   - **Build command:** `npm run build:cf`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
5. اضغط **Deploy** واستنى البناء يخلص.

> ملحوظة: ممكن كمان تنشر من جهازك مباشرة بأمر واحد: `bun run deploy:cf` بعد ما تعمل `wrangler login`.

## متغيرات البيئة المطلوبة

في **Workers → Settings → Variables and Secrets** ضيف الاتنين دول (من لوحة Turso الخاصة بالمنصة دي نفسها):

- `TURSO_DATABASE_URL` — رابط قاعدة البيانات على Turso.
- `TURSO_AUTH_TOKEN` — التوكن بتاع Turso (حطه كـ **Secret** مش متغير عادي).

## الدومين المخصص

من **Workers → Settings → Domains & Routes → Add Custom Domain**، اكتب الدومين بتاعك (لازم يكون مسجل DNS عنده على كلاود فلير أو اربط الـ nameservers)، وكلاود فلير هيظبط الشهادة والـ DNS لوحده.

## ملاحظة مهمة: قص الرسمات (canvas)

قص الرسمات على السيرفر بيستخدم مكتبة `@napi-rs/canvas` الأصلية (ملف `.node` binary)، ودي **ما بتشتغلش** داخل Workers runtime (البيئة هناك مش Linux binaries عادية). البناء بيعدي عادي والملفات بتتلف مع الحزمة، بس الميزة دي ممكن تتأثر وقت التشغيل على كلاود فلير — لو قص الرسمات وقف لازم يتظبط بطريقة تانية (زي WebAssembly أو معالجة على جهاز المستخدم).

## خطوة التحقق بعد النشر

1. افتح الصفحة الرئيسية للمنصة وتأكد إنها بتفتح من غير أخطاء.
2. جرب تسجيل دخول أدمن وتأكد إنه شغال وتقدر تفتح لوحة التحكم.
3. (اختياري) افتح `/api/health` وتأكد إنها بترجع رد طبيعي.
