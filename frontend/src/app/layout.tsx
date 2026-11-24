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
          targetSelector=".cursor-target, [data-cursor='target'], button, a[href], [role='button'], .react-flow__node, input[type='text'], input[type='search']"
          cursorColor="#22d3ee"
          cursorColorOnTarget="#c084fc"
          spinDuration={3}
          hoverDuration={0.2}
          parallaxOn={true}
          hideDefaultCursor={true}
          size={32}
          cornerSize={10}
          thickness={1.75}
          padding={5}
          matchRadius={true}
          dotSize={3}
          blendMode="normal"
        />
      </body>
    </html>
  );
}
