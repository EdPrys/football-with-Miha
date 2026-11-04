'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sharedGameUrl, playerInvitation } from '@/lib/game-sharing';

export function ShareGame({
  eventId,
  venue,
  organizer = false,
  campaign,
}: {
  eventId: string;
  venue: string;
  organizer?: boolean;
  campaign?: string | null;
}) {
  const [manualUrl, setManualUrl] = useState('');
  const share = async () => {
    const url = sharedGameUrl(window.location.origin, eventId, campaign);
    const invitation = playerInvitation(url);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Футбол · ${venue}`,
          text: organizer ? invitation : 'Приєднуйся до гри в Kopanka!',
          ...(!organizer ? { url } : {}),
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(organizer ? invitation : url);
      toast.success(
        organizer
          ? 'Запрошення скопійовано — надішли його у свою групу'
          : 'Посилання скопійовано — надішли його другу',
      );
    } catch {
      setManualUrl(organizer ? invitation : url);
      toast('Скопіюй посилання нижче');
    }
  };
  return (
    <div className="order-2 space-y-2">
      <Button variant="outline" className="w-full gap-2" onClick={share}>
        <Share2 className="size-4" />
        {organizer ? 'Запросити свою групу' : 'Запросити друга'}
      </Button>
      {manualUrl && (
        <textarea
          aria-label={organizer ? 'Запрошення для групи' : 'Посилання на гру'}
          readOnly
          rows={organizer ? 4 : 2}
          value={manualUrl}
          onFocus={(e) => e.target.select()}
          className="w-full min-w-0 rounded-lg border border-input bg-background p-3 text-base md:text-sm"
        />
      )}
    </div>
  );
}
