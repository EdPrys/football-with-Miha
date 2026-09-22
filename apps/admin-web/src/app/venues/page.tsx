'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { RequireAdmin } from '@/components/require-admin';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function AddFieldForm({ venueId, onDone }: { venueId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('10');
  const addField = trpc.venues.addField.useMutation({
    onSuccess: () => {
      toast.success('Поле додано');
      setName('');
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;
    addField.mutate({ venueId, name, capacity: Number(capacity) });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
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
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="w-24"
        />
      </div>
      <Button type="submit" size="sm" disabled={addField.isPending}>
        <Plus className="mr-1 size-3.5" /> Додати поле
      </Button>
    </form>
  );
}

function VenuesPageContent() {
  const utils = trpc.useUtils();
  const venues = trpc.venues.list.useQuery();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const createVenue = trpc.venues.create.useMutation({
    onSuccess: () => {
      toast.success('Майданчик створено');
      setName('');
      setCity('');
      utils.venues.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const submitVenue = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !city) return;
    createVenue.mutate({ name, city });
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
        <form onSubmit={submitVenue} className="flex flex-wrap items-end gap-2">
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
            <Label htmlFor="venue-city" className="text-xs">
              Місто
            </Label>
            <Input
              id="venue-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Kyiv"
              className="w-40"
            />
          </div>
          <Button type="submit" disabled={createVenue.isPending}>
            <Plus className="mr-1 size-4" /> Створити
          </Button>
        </form>
      </Card>

      {venues.isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
      <div className="space-y-3">
        {venues.data?.map((v) => (
          <Card key={v.id} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{v.name}</p>
                <p className="text-sm text-muted-foreground">{v.city}</p>
              </div>
              <Badge variant="secondary">{v.fields.length} полів</Badge>
            </div>
            {v.fields.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {v.fields.map((f) => (
                  <Badge key={f.id} variant="outline">
                    {f.name} · {f.capacity}
                  </Badge>
                ))}
              </div>
            )}
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
