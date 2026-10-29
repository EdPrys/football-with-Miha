import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getEventPreview, slotsLabel } from '@/lib/event-preview';
import { SITE_NAME } from '@/lib/site';

// The event page is a client component, so its link-preview title and
// description come from this server layout instead.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventPreview(id);
  if (!event) return { title: 'Гра' };

  const title = `Футбол ${event.format}, ${event.day} ${event.time}`;
  const description = `${event.place}. ${slotsLabel(event)}.`;
  return {
    title,
    description,
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'uk_UA', title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function EventLayout({ children }: { children: ReactNode }) {
  return children;
}
