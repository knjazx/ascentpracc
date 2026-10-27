import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Header } from '@/components/header/Header';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
});

const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: 'CS2 Scrims & Practice League | Киберспортивные праки CS2',
  description:
    'Платформа для поиска и проведения праков (скримов) по Counter-Strike 2. Интерактивное вето карт, живые лобби, автоматический подсчет результатов и рейтинговая лига.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} ${montserrat.variable} font-sans min-h-screen flex flex-col bg-background text-foreground`}>
        <AuthProvider>
          <Header />
          <main className="flex-1 pb-16">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
