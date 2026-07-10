import type { Metadata } from 'next';
import { Lexend_Deca } from 'next/font/google';
import './globals.css';

const lexendDeca = Lexend_Deca({ subsets: ['latin'], weight: '500' });

export const metadata: Metadata = {
  title: 'WhatsLark — WhatsApp CRM for Sales, Support & Automation',
  description: 'Manage your WhatsApp conversations, leads, contacts and campaigns in one place.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={lexendDeca.className}>{children}</body>
    </html>
  );
}
