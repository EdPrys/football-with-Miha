'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ShareGame({ eventId, venue }: { eventId: string; venue: string }) {
  const [manualUrl, setManualUrl] = useState('');
  const share = async () => {
    const url = new URL(`/events/${encodeURIComponent(eventId)}`, window.location.origin).href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Футбол · ${venue}`,
          text: 'Приєднуйся до гри в Kopanka!',
          url,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Посилання скопійовано — надішли його другу');
    } catch {
      setManualUrl(url);
      toast('Скопіюй посилання нижче');
    }
  };
  return (
    <div className="order-2 space-y-2">
      <Button variant="outline" className="w-full gap-2" onClick={share}>
        <Share2 className="size-4" />
        Запросити друга
      </Button>
      {manualUrl && (
        <Input
          aria-label="Посилання на гру"
          readOnly
          value={manualUrl}
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}
