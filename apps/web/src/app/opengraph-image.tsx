import { ImageResponse } from 'next/og';
import { OG_SIZE, OgFrame, ogFonts } from '@/lib/og';

export const alt = 'Kopanka — футбол поруч';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <OgFrame footer="kopanka.pro">
      <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
        Футбол поруч
      </div>
      <div style={{ marginTop: 24, fontSize: 38, fontWeight: 500, color: '#e6fbef' }}>
        Знайди гру, займи місце на полі, грай і отримуй оцінки від партнерів.
      </div>
    </OgFrame>,
    { ...size, fonts: await ogFonts() },
  );
}
