import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: '배드민턴 동호회 회원 관리 시스템 (Cafe24 - MySQL)',
  description: '카페24 웹호스팅 환경에서 Node.js와 MySQL로 구동되는 최강의 배드민턴 동호회 회원 관리 솔루션',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

