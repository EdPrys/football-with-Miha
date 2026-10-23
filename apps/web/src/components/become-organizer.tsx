'use client';

import { Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** Lets a player ask for organizer rights; requests are auto-approved for now. */
export function BecomeOrganizer({ className }: { className?: string }) {
  const utils = trpc.useUtils();
  const request = trpc.users.requestOrganizer.useMutation({
    onSuccess: async (d) => {
      await utils.invalidate();
      if (d.status === 'APPROVED') {
        toast.success('Тепер ти організатор! Можеш створювати ігри й додавати майданчики.');
      } else {
        toast.success('Запит надіслано. Ми повідомимо, коли його розглянуть.');
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card className={className}>
      <div className="flex items-start gap-3 p-5">
        <Megaphone className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="font-semibold">Хочеш організовувати ігри?</h2>
            <p className="text-sm text-muted-foreground">
              Організатор створює ігри, додає майданчики й поля та керує складами команд.
            </p>
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={request.isPending}
            onClick={() => request.mutate()}
          >
            {request.isPending ? '...' : 'Стати організатором'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
