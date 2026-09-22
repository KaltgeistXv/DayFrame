import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DayFrame · 个人效率工作台',
  description: '在简洁的工作空间里，规划日程、推进项目、完成重要的事。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
