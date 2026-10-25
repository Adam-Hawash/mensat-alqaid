import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { RadixDirection } from "@/components/RadixDirection";
import { AIAssistant } from "@/components/student/AIAssistant";
import { RecordingGuard } from "@/components/RecordingGuard";
import { DevToolsGuard } from "@/components/DevToolsGuard";
/* (2026-Z32) زرار تثبيت المنصة كتطبيق — عايم ثابت في كل الصفحات (زي Maths-Genius) */
import { FloatingInstallButton } from "@/components/InstallPwaButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export var metadata: Metadata = {
  title: "منصة القائد - مستر عمرو رشدي",
  description:
    "منصة القائد - أ. عمرو رشدي. نبسّط لك الدراسات والتاريخ ونجعلها سهلة وممتعة! حصص مباشرة، واجبات أسبوعية، امتحانات منتظمة، ومتابعة مستمرة.",
  openGraph: {
    title: "منصة القائد - مستر عمرو رشدي",
    description: "نبسّط لك الدراسات والتاريخ ونجعلها سهلة وممتعة! حصص مباشرة، واجبات أسبوعية، ومتابعة مستمرة.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  var initialConfig: Record<string, string> = {};
  try {
    var dbPromise = import("@/lib/db").then(function(dbModule) {
      return dbModule.db.siteConfig.findMany();
    });
    var configs = await Promise.race([
      dbPromise,
      new Promise(function(resolve) { setTimeout(function() { resolve([]) }, 3000) })
    ]);
    for (var i = 0; i < (configs as any[]).length; i++) {
      initialConfig[(configs as any[])[i].key] = (configs as any[])[i].value;
    }
  } catch (e) {
    /* DB not available yet */
  }

  var faviconUrl = initialConfig.favicon_url || "/favicon.png";
  var instructorPhoto = initialConfig.instructor_photo || "/images/instructor.jpg";

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        <link rel="icon" href={faviconUrl} />

        {/* (ز17) PWA — تثبيت المنصة كتطبيق + ثيم الموبايل + أيقونة الشاشة الرئيسية */}
        <meta name="theme-color" content="#0D9488" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="منصة القائد" />

        {/* Preload instructor photo so it's ready immediately when hero renders */}
        <link rel="preload" as="image" href={instructorPhoto} fetchPriority="high" />

        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__INITIAL_CONFIG__=" +
              JSON.stringify(initialConfig),
          }}
        />
        {/* (ز17) تسجيل الـ Service Worker — الأوفلاين + إشعارات أولياء الأمور */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}}catch(e){}",
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "Cairo, sans-serif" }}
      >
        <ThemeProvider><RadixDirection>{children}</RadixDirection></ThemeProvider>
        {/* (و47) المساعد الذكي رجع زي ما كان — المستر طلبه بنفس المميزات (شيرين بس هي اللي اتشالت) */}
        <AIAssistant />
        {/* (2026-Z32) الزرار العايم الثابت «ثبّت التطبيق» — شمال تحت في كل الصفحات (زي Maths-Genius) */}
        <FloatingInstallButton />
        {/* حماية عامة من التسجيل/التصوير + أدوات المطوّر في كل الصفحات */}
        <RecordingGuard />
        {/* (ز19) حارس أدوات المطوّر — شاشة سودة + عداد 35 ثانية + مسح الحساب (طلب المستر) */}
        <DevToolsGuard />
        <Toaster />
        {/* Toaster بتاع sonner — كل رسائل التنبيه في المنصة بتستخدمه */}
        <SonnerToaster position="top-center" richColors closeButton expand={false} />
      </body>
    </html>
  );
}
