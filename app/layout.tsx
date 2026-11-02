import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBar, StatusBarFallback } from "@/components/StatusBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "공공정부기관 발주현황 트렌드",
  description: "중앙부처 SW 사업 입찰공고를 분야별로 모아 발주 추이와 유사 사례를 보여줍니다.",
};

// 공통 틀: 한국어 페이지, 상단에 앱 이름과 상태 줄
// Design Ref: §5.1 — 모든 화면 상단에 수집 시각·출처를 표시한다.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 dark:bg-black">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-8">
          <header className="flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <Link href="/" className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">
              공공정부기관 발주현황 트렌드
            </Link>
            <Suspense fallback={<StatusBarFallback />}>
              <StatusBar />
            </Suspense>
          </header>
          <main className="flex flex-col gap-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
