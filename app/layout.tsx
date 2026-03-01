import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Wallpaper } from '@/components/Wallpaper';
import { getImageOTD } from '@/lib/nasa';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lunar Void Dash',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apod = await getImageOTD();

  return (
    <html lang="en" className={`${montserrat.variable} h-full`}>
      <body className="overflow-hidden h-full">
        <Providers>
          <Wallpaper apod={apod} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
