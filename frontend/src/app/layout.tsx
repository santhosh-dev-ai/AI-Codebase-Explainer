import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { TargetCursor } from '@/components/react-bits';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
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
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        {children}
        <TargetCursor
          cursorColor="#22d3ee"
          spinDuration={3}
          hideDefaultCursor={true}
          size={32}
          cornerSize={10}
          thickness={1.75}
          dotSize={3}
          blendMode="normal"
          clickEffect={true}
          followSpeed={0.45}
        />
      </body>
    </html>
  );
}
