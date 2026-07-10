import type { Metadata } from 'next';
import { Lexend_Deca } from 'next/font/google';
import './globals.css';

const lexendDeca = Lexend_Deca({ subsets: ['latin'], weight: '300', variable: '--font-lexend-deca' });

export const metadata: Metadata = {
  title: 'WhatsLark — WhatsApp CRM for Sales, Support & Automation',
  description: 'Manage your WhatsApp conversations, leads, contacts and campaigns in one place.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lexendDeca.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
