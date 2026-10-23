'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImageUp } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { PlayerAvatar } from './player-avatar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const AVATAR_SIZE = 256;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Center-crop to a square and downscale, so the stored image stays a few dozen KB. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

export function AvatarEditor({ name, url }: { name: string; url: string | null }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(url ?? '');
  const [processing, setProcessing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Обери файл зображення');
    if (file.size > MAX_FILE_BYTES) return toast.error('Файл завеликий (максимум 15 МБ)');
    setProcessing(true);
    try {
      setValue(await toAvatarDataUrl(file));
    } catch {
      toast.error('Не вдалося відкрити це зображення. Спробуй інший файл.');
    } finally {
      setProcessing(false);
    }
  };

  const save = trpc.users.updateAvatar.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      toast.success('Аватар оновлено');
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValue(url ?? '');
          setOpen(true);
        }}
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
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickFile}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={processing || save.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <ImageUp />
              {processing ? 'Обробка...' : 'Обрати фото'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Фото обріжеться до квадрата по центру
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={save.isPending || processing}
              onClick={() => save.mutate({ avatarUrl: null })}
            >
              Прибрати
            </Button>
            <Button
              disabled={save.isPending || processing || value === (url ?? '')}
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
