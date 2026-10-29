import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReactNode } from 'react';

// Shared frame for link-preview images (Telegram, Viber, Facebook…).
// next/og's built-in font has no Cyrillic, so we ship Inter ourselves.

export const OG_SIZE = { width: 1200, height: 630 };

export async function ogFonts() {
  const dir = join(process.cwd(), 'src/assets');
  const [regular, bold] = await Promise.all([
    readFile(join(dir, 'inter-500.ttf')),
    readFile(join(dir, 'inter-800.ttf')),
  ]);
  return [
    { name: 'Inter', data: regular, weight: 500 as const, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: 800 as const, style: 'normal' as const },
  ];
}

function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path
        d="M10 66 Q50 34 90 66"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="50" cy="38" r="17" fill="#3ddc84" />
      <path d="M50 26 L60 33 L56 45 L44 45 L40 33 Z" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}

export function OgFrame({ children, footer }: { children: ReactNode; footer: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        color: '#ffffff',
        fontFamily: 'Inter',
        backgroundColor: '#0b3d22',
        backgroundImage: 'linear-gradient(135deg, #0b3d22 0%, #118f4a 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <LogoMark size={72} />
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>Kopanka</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
      <div style={{ display: 'flex', fontSize: 30, fontWeight: 500, color: '#c8f5d8' }}>
        {footer}
      </div>
    </div>
  );
}
