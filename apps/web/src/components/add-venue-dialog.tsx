'use client';

import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NEW_VENUE = '__new__';

/**
 * Organizer adds a field, either to an existing venue or together with a new
 * venue. Calls back with the new field id so the caller can preselect it.
 */
export function AddVenueDialog({
  venues,
  onCreated,
}: {
  venues: { id: string; name: string; city: string }[];
  onCreated: (fieldId: string) => void;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [venueId, setVenueId] = useState(NEW_VENUE);
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [capacity, setCapacity] = useState('10');

  const createVenue = trpc.venues.create.useMutation();
  const addField = trpc.venues.addField.useMutation();
  const pending = createVenue.isPending || addField.isPending;

  const reset = () => {
    setVenueId(NEW_VENUE);
    setVenueName('');
    setCity('');
    setFieldName('');
    setCapacity('10');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const targetVenueId =
        venueId === NEW_VENUE
          ? (await createVenue.mutateAsync({ name: venueName.trim(), city: city.trim() })).id
          : venueId;
      const field = await addField.mutateAsync({
        venueId: targetVenueId,
        name: fieldName.trim(),
        capacity: Number(capacity),
      });
      await utils.venues.list.invalidate();
      toast.success('Поле додано');
      onCreated(field.id);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <Button type="button" variant="link" className="h-auto p-0" onClick={() => setOpen(true)}>
        <Plus />
        Немає потрібного поля? Додати
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Додати поле</DialogTitle>
          </DialogHeader>
          <form id="add-venue" onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Майданчик</Label>
              <Select value={venueId} onValueChange={(v) => v && setVenueId(v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(id: string) =>
                      id === NEW_VENUE
                        ? '+ Новий майданчик'
                        : (venues.find((v) => v.id === id)?.name ?? null)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_VENUE}>+ Новий майданчик</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} · {v.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {venueId === NEW_VENUE && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="venueName">Назва</Label>
                  <Input
                    id="venueName"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="Стадіон «Сокіл»"
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">Місто</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Київ"
                    maxLength={120}
                    required
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fieldName">Поле / зал</Label>
                <Input
                  id="fieldName"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="Поле 1"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capacity">Місткість (гравців)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  required
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="add-venue" disabled={pending}>
              {pending ? '...' : 'Додати'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
