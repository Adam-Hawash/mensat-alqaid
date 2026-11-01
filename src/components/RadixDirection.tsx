'use client'

/* ============================================================
   (ز20) مزوّد اتجاه Radix — إصلاح «الترتيب المعكوس» في لوحة التحكم
   ============================================================
   مكوّنات Radix (التابات/القوائم/الدايلوجات) بتطلع dir="ltr" مرشم
   عليها من المكتبة نفسها لما ميبقاش DirectionProvider — فجذر <Tabs>
   بيتقلب LTR جوه صفحة RTL وشكل التابات بيطلع معكوس (أول تاب على
   الشمال بدل اليمين). المنصة دي عربي RTL دايمًا فالمزوّد ثابت rtl. */
import * as React from 'react'
import { DirectionProvider } from '@radix-ui/react-direction'

export function RadixDirection({ children }: { children: React.ReactNode }) {
  return <DirectionProvider dir="rtl">{children}</DirectionProvider>
}
