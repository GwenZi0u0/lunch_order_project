import './globals.css';
import BackToTopButton from '@/components/BackToTopButton';

export const metadata = {
  title: '午餐訂購系統 — TSA Lunch',
  description: '現場をもっと自由に、面白く ─ 讓訂餐更自由、更便利、更有趣！',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      </head>
      <body className="bg-kaizen-bg text-kaizen-dark min-h-screen flex flex-col">
        {children}
        <BackToTopButton />
      </body>
    </html>
  );
}
