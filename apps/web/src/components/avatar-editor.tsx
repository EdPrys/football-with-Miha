'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { PlayerAvatar } from './player-avatar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function AvatarEditor({ name, url }: { name: string; url: string | null }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(url ?? '');

  const save = trpc.users.updateAvatar.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      toast.success('Аватар оновлено');
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative shrink-0"
        aria-label="Змінити аватар"
      >
        <PlayerAvatar name={name} url={url} className="size-14" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1 text-primary-foreground">
          <Camera className="size-3" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Аватар</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-center">
              <PlayerAvatar name={name} url={value.trim() || null} className="size-20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avatarUrl">URL зображення</Label>
              <Input
                id="avatarUrl"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Встав посилання на зображення. Завантаження з пристрою — згодом.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() => save.mutate({ avatarUrl: null })}
            >
              Прибрати
            </Button>
            <Button
              disabled={save.isPending}
              onClick={() => save.mutate({ avatarUrl: value.trim() || null })}
            >
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
