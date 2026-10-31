'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  VenueDetails,
  FieldDetails,
  venueMetadata,
  fieldMetadata,
  verificationMetadata,
  type VenueMetadata,
  type FieldMetadata,
} from '@/components/venues/metadata';
import { RequireAdmin } from '@/components/require-admin';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function AddFieldForm({ venueId, onDone }: { venueId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [version, setVersion] = useState(0);
  const addField = trpc.venues.addField.useMutation({
    onSuccess: () => {
      toast.success('Поле додано');
      setName('');
      setCapacity('');
      setVersion((v) => v + 1);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    addField.mutate({
      venueId,
      name: name.trim(),
      ...fieldMetadata(new FormData(e.currentTarget)),
    });
  };

  return (
    <form key={version} onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={`field-name-${venueId}`} className="text-xs">
          Назва поля
        </Label>
        <Input
          id={`field-name-${venueId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Поле 1"
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`field-cap-${venueId}`} className="text-xs">
          Місткість
        </Label>
        <Input
          id={`field-cap-${venueId}`}
          name="capacity"
          placeholder="Невідомо"
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="w-24"
        />
      </div>
      <FieldDetails />
      <Button type="submit" size="sm" disabled={addField.isPending}>
        <Plus className="mr-1 size-3.5" /> Додати поле
      </Button>
    </form>
  );
}

function VenueEditor({
  venue,
  onDone,
}: {
  venue: VenueMetadata & { id: string; name: string };
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const update = trpc.venues.update.useMutation({
    onSuccess: () => {
      toast.success('Майданчик оновлено');
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-lg border border-border p-3"
    >
      <summary className="cursor-pointer text-sm">Редагувати майданчик</summary>
      {open && (
        <form
          key={venue.id}
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            update.mutate({
              id: venue.id,
              name: String(data.get('name')).trim(),
              ...venueMetadata(data),
              ...verificationMetadata(data),
            });
          }}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            Назва
            <Input name="name" required defaultValue={venue.name} />
          </label>
          <VenueDetails value={venue} verification />
          <Button type="submit" size="sm" disabled={update.isPending}>
            Зберегти майданчик
          </Button>
        </form>
      )}
    </details>
  );
}

function FieldEditor({
  field,
  onDone,
}: {
  field: FieldMetadata & { id: string; name: string };
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const update = trpc.venues.updateField.useMutation({
    onSuccess: () => {
      toast.success('Поле оновлено');
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-lg border border-border p-3"
    >
      <summary className="cursor-pointer text-sm">
        {field.name} · {field.capacity == null ? 'Місткість невідома' : `${field.capacity} гравців`}{' '}
        · Редагувати
      </summary>
      {open && (
        <form
          key={field.id}
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            update.mutate({
              id: field.id,
              name: String(data.get('name')).trim(),
              ...fieldMetadata(data),
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Назва поля
              <Input name="name" required defaultValue={field.name} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Місткість (гравців)
              <Input
                name="capacity"
                type="number"
                min={1}
                step="1"
                placeholder="Невідомо"
                defaultValue={field.capacity ?? ''}
              />
            </label>
          </div>
          <FieldDetails value={field} />
          <Button type="submit" size="sm" disabled={update.isPending}>
            Зберегти поле
          </Button>
        </form>
      )}
    </details>
  );
}

function VenuesPageContent() {
  const utils = trpc.useUtils();
  const venues = trpc.venues.list.useQuery();
  const cities = trpc.cities.list.useQuery();

  const [name, setName] = useState('');
  const [cityId, setCityId] = useState('kyiv');
  const [createVersion, setCreateVersion] = useState(0);
  const createVenue = trpc.venues.create.useMutation({
    onSuccess: () => {
      toast.success('Майданчик створено');
      setName('');
      setCreateVersion((v) => v + 1);
      utils.venues.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const submitVenue = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    createVenue.mutate({
      name: name.trim(),
      cityId,
      ...venueMetadata(new FormData(e.currentTarget)),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Майданчики</h1>
        <p className="text-sm text-muted-foreground">
          Каталог майданчиків і полів, доступних для створення ігор.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <p className="text-sm font-semibold text-muted-foreground">Новий майданчик</p>
        <form key={createVersion} onSubmit={submitVenue} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="venue-name" className="text-xs">
              Назва
            </Label>
            <Input
              id="venue-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Football Hub"
              className="w-52"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Місто</Label>
            <Select value={cityId} onValueChange={(v) => v && setCityId(v)}>
              <SelectTrigger className="w-48">
                <SelectValue>
                  {(id: string) => cities.data?.find((c) => c.id === id)?.name ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(cities.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <VenueDetails />
          <Button type="submit" disabled={createVenue.isPending}>
            <Plus className="mr-1 size-4" /> Створити
          </Button>
        </form>
      </Card>

      {venues.isError && (
        <p role="alert" className="text-sm text-destructive">
          Не вдалося завантажити каталог.{' '}
          <Button variant="outline" size="sm" onClick={() => venues.refetch()}>
            Повторити
          </Button>
        </p>
      )}
      {venues.isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
      <div className="space-y-3">
        {venues.data?.map((v) => (
          <Card key={v.id} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{v.name}</p>
                <p className="text-sm text-muted-foreground">{v.city.name}</p>
              </div>
              <Badge variant="secondary">{v.fields.length} полів</Badge>
            </div>
            {v.fields.length > 0 && (
              <div className="space-y-2">
                {v.fields.map((f) => (
                  <FieldEditor key={f.id} field={f} onDone={() => utils.venues.list.invalidate()} />
                ))}
              </div>
            )}
            <VenueEditor venue={v} onDone={() => utils.venues.list.invalidate()} />
            <AddFieldForm venueId={v.id} onDone={() => utils.venues.list.invalidate()} />
          </Card>
        ))}
        {venues.data && venues.data.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Ще немає жодного майданчика.
          </Card>
        )}
      </div>
    </div>
  );
}

export default function VenuesPage() {
  return (
    <RequireAdmin>
      <VenuesPageContent />
    </RequireAdmin>
  );
}
