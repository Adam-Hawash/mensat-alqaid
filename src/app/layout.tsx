import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

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

        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__INITIAL_CONFIG__=" +
              JSON.stringify(initialConfig),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "Cairo, sans-serif" }}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
