import { ImageResponse } from 'next/og';
import { OG_SIZE, OgFrame, ogFonts } from '@/lib/og';
import { getEventPreview, slotsLabel } from '@/lib/event-preview';

export const alt = 'Гра у футбол на Kopanka';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, fonts] = await Promise.all([getEventPreview(id), ogFonts()]);

  if (!event) {
    return new ImageResponse(
      <OgFrame footer="kopanka.pro">
        <div style={{ fontSize: 84, fontWeight: 800 }}>Гра у футбол</div>
      </OgFrame>,
      { ...size, fonts },
    );
  }

  const open = event.status === 'UPCOMING' && event.availableSlots > 0;
  return new ImageResponse(
    <OgFrame footer={open ? 'Приєднуйся на kopanka.pro' : 'kopanka.pro'}>
      <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
        {`${event.day[0].toUpperCase()}${event.day.slice(1)}`}
      </div>
      <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, color: '#3ddc84' }}>
        {event.time}
      </div>
      <div style={{ marginTop: 20, fontSize: 40, fontWeight: 500, color: '#e6fbef' }}>
        {`${event.place} · ${event.format}`}
      </div>
      <div style={{ display: 'flex', marginTop: 36 }}>
        <div
          style={{
            display: 'flex',
            padding: '12px 28px',
            borderRadius: 999,
            fontSize: 36,
            fontWeight: 800,
            backgroundColor: open ? '#3ddc84' : 'rgba(255,255,255,0.18)',
            color: open ? '#0b3d22' : '#ffffff',
          }}
        >
          {slotsLabel(event)}
        </div>
      </div>
    </OgFrame>,
    { ...size, fonts },
  );
}
