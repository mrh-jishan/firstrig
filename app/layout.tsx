import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import Nav from '@/components/Nav';
import { PrefsProvider } from '@/components/prefs';

export const metadata: Metadata = {
  title: 'FirstRig - Build your first PC with confidence',
  description: 'Tell us what you do and your budget. Get a compatible build, see it in 3D, then follow a step-by-step assembly guide made for your exact parts.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0f14' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrefsProvider>
          <Suspense fallback={<nav className="nav" />}><Nav /></Suspense>
          <Suspense fallback={<div className="wrap muted">Loading...</div>}>{children}</Suspense>
        </PrefsProvider>
      </body>
    </html>
  );
}
