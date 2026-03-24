import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Codebase Explainer - AI-Powered Code Understanding',
  description: 'Understand any codebase instantly with AI-powered analysis, explanations, and insights',
  keywords: ['code analysis', 'AI', 'code explainer', 'developer tools'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  );
}
