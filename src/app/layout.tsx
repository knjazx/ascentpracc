import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Header } from '@/components/header/Header';
import { DataPrefetcher } from '@/components/providers/DataPrefetcher';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
});

const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: 'Ascent Pracc | CS2 Scrims & Practice League',
  description:
    'Ascent Pracc — киберспортивная платформа для поиска и проведения праков (скримов) по Counter-Strike 2. Интерактивное вето карт, живые лобби, автоматический подсчет результатов и рейтинговая таблица.',
  icons: {
    icon: '/images/ascent-icon.png',
    apple: '/images/ascent-icon.png',
  },
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
          <DataPrefetcher />
          <Header />
          <main className="flex-1 pb-16">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
