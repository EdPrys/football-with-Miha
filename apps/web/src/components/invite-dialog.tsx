'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InvitePlayers } from '@/components/invite-players';

/** "Invite players" button on an upcoming game: pick players from its city. */
export function InviteDialog({
  eventId,
  cityName,
  className,
}: {
  eventId: string;
  cityName: string;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const candidates = trpc.invitations.candidates.useQuery({ eventId }, { enabled: open });
  const send = trpc.invitations.sendMany.useMutation({
    onSuccess: ({ invited }) => {
      toast.success(`Запрошено гравців: ${invited}`);
      utils.invitations.candidates.invalidate({ eventId });
      setSelected([]);
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)}>
        <UserPlus className="mr-1 size-4" /> Запросити гравців
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Запросити гравців</DialogTitle>
          </DialogHeader>
          <InvitePlayers
            players={candidates.data}
            loading={candidates.isLoading}
            cityName={cityName}
            selected={selected}
            onChange={setSelected}
          />
          <DialogFooter>
            <Button
              disabled={send.isPending || selected.length === 0}
              onClick={() => send.mutate({ eventId, invitedUserIds: selected })}
            >
              {send.isPending ? '...' : `Запросити (${selected.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
