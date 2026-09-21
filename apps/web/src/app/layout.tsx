import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Football — pickup games',
  description: 'Знаходь ігри, приєднуйся, грай, оцінюй гравців.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="uk"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <AppShell>{children}</AppShell>
            <Toaster richColors position="top-center" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
