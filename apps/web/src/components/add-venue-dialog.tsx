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
import { CitySelect } from '@/components/city-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  OptionalSelect,
  environmentLabels,
  surfaceLabels,
  booleanOptions,
  optionalBoolean,
} from '@/components/venue-details-controls';

const NEW_VENUE = '__new__';

/**
 * Organizer adds a field, either to an existing venue or together with a new
 * venue. Calls back with the new field id so the caller can preselect it.
 */
export function AddVenueDialog({
  venues,
  onCreated,
  selectedCityId = 'kyiv',
}: {
  venues: { id: string; name: string; cityId: string; city: { name: string } }[];
  onCreated: (fieldId: string, venueId: string, cityId: string) => void;
  selectedCityId?: string;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [venueId, setVenueId] = useState(NEW_VENUE);
  const [venueName, setVenueName] = useState('');
  const [cityId, setCityId] = useState(selectedCityId);
  const [fieldName, setFieldName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const updateDetail = (key: string, value: string) =>
    setDetails((previous) => ({ ...previous, [key]: value }));
  const [createdVenue, setCreatedVenue] = useState<{
    id: string;
    name: string;
    cityId: string;
    city: { name: string };
  } | null>(null);
  const availableVenues =
    createdVenue && !venues.some((v) => v.id === createdVenue.id)
      ? [...venues, createdVenue]
      : venues;

  const createVenue = trpc.venues.create.useMutation();
  const addField = trpc.venues.addField.useMutation();
  const pending = createVenue.isPending || addField.isPending;

  const reset = () => {
    setVenueId(NEW_VENUE);
    setVenueName('');
    setCityId(selectedCityId);
    setFieldName('');
    setCapacity('');
    setDetails({});
    setCreatedVenue(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Portal events still bubble through the parent game's form in React.
    e.stopPropagation();
    try {
      let targetVenueId = venueId;
      if (venueId === NEW_VENUE) {
        const result = await createVenue.mutateAsync({
          name: venueName.trim(),
          cityId,
          address: details.address?.trim() || undefined,
          contactPhone: details.contactPhone?.trim() || undefined,
          websiteUrl: details.websiteUrl?.trim() || undefined,
          hasChangingRooms: optionalBoolean(details.hasChangingRooms ?? ''),
          hasShowers: optionalBoolean(details.hasShowers ?? ''),
          hasParking: optionalBoolean(details.hasParking ?? ''),
        });
        targetVenueId = result.id;
        // Preserve a successfully created venue if adding its field fails, so retry won't duplicate it.
        setCreatedVenue({ id: result.id, name: venueName.trim(), cityId, city: { name: '' } });
        setVenueId(result.id);
      }
      const field = await addField.mutateAsync({
        venueId: targetVenueId,
        name: fieldName.trim(),
        capacity: capacity.trim() ? Number(capacity) : undefined,
        environment: (details.environment || undefined) as
          keyof typeof environmentLabels | undefined,
        surface: (details.surface || undefined) as keyof typeof surfaceLabels | undefined,
        hasLighting: optionalBoolean(details.hasLighting ?? ''),
        lengthMeters: details.lengthMeters?.trim() ? Number(details.lengthMeters) : undefined,
        widthMeters: details.widthMeters?.trim() ? Number(details.widthMeters) : undefined,
      });
      await utils.venues.list.invalidate();
      toast.success('Поле додано');
      const targetCityId =
        venueId === NEW_VENUE ? cityId : availableVenues.find((v) => v.id === venueId)?.cityId;
      onCreated(field.id, targetVenueId, targetCityId ?? selectedCityId);
      setOpen(false);
      reset();
    } catch (err) {
      void utils.venues.list.invalidate();
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="link"
        className="h-auto p-0"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus />
        Немає потрібного поля? Додати
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Додати поле</DialogTitle>
          </DialogHeader>
          <form id="add-venue" onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-venue-select">Майданчик</Label>
              <Select value={venueId} onValueChange={(v) => v && setVenueId(v)}>
                <SelectTrigger id="add-venue-select" className="h-11 min-h-11 md:h-11">
                  <SelectValue>
                    {(id: string) =>
                      id === NEW_VENUE
                        ? '+ Новий майданчик'
                        : (availableVenues.find((v) => v.id === id)?.name ?? null)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_VENUE}>+ Новий майданчик</SelectItem>
                  {availableVenues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} · {v.city.name}
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
                    className="h-11 min-h-11 md:h-11"
                    id="venueName"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="Стадіон «Сокіл»"
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="venue-city">Місто</Label>
                  <CitySelect
                    id="venue-city"
                    value={cityId}
                    onChange={setCityId}
                    className="w-full"
                  />
                </div>
              </div>
            )}
            {venueId === NEW_VENUE && (
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Контакти та зручності · необов’язково
                </summary>
                <div className="mt-4 space-y-3">
                  {(
                    [
                      ['address', 'Адреса', 'text'],
                      ['contactPhone', 'Телефон', 'tel'],
                      ['websiteUrl', 'Вебсайт', 'url'],
                    ] as const
                  ).map(([key, label, type]) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`venue-${key}`}>{label}</Label>
                      <Input
                        id={`venue-${key}`}
                        type={type}
                        className="h-11 md:h-11"
                        value={details[key] ?? ''}
                        onChange={(e) => updateDetail(key, e.target.value)}
                        maxLength={key === 'address' ? 300 : key === 'contactPhone' ? 80 : 2048}
                        placeholder={type === 'url' ? 'https://…' : undefined}
                      />
                    </div>
                  ))}
                  {(
                    [
                      ['hasChangingRooms', 'Роздягальні'],
                      ['hasShowers', 'Душові'],
                      ['hasParking', 'Паркування'],
                    ] as const
                  ).map(([key, label]) => (
                    <OptionalSelect
                      key={key}
                      id={`venue-${key}`}
                      label={label}
                      value={details[key] ?? ''}
                      onChange={(value) => updateDetail(key, value)}
                      options={booleanOptions}
                    />
                  ))}
                </div>
              </details>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="fieldName">Поле / зал</Label>
              <Input
                className="h-11 min-h-11 md:h-11"
                id="fieldName"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="Поле 1"
                maxLength={120}
                required
              />
            </div>
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Характеристики поля · необов’язково
              </summary>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="capacity">Місткість (гравців)</Label>
                  <Input
                    id="capacity"
                    className="h-11 md:h-11"
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="Невідомо"
                  />
                </div>
                <OptionalSelect
                  id="field-environment"
                  label="Тип поля"
                  value={details.environment ?? ''}
                  onChange={(value) => updateDetail('environment', value)}
                  options={environmentLabels}
                />
                <OptionalSelect
                  id="field-surface"
                  label="Покриття"
                  value={details.surface ?? ''}
                  onChange={(value) => updateDetail('surface', value)}
                  options={surfaceLabels}
                />
                <OptionalSelect
                  id="field-lighting"
                  label="Освітлення"
                  value={details.hasLighting ?? ''}
                  onChange={(value) => updateDetail('hasLighting', value)}
                  options={booleanOptions}
                />
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ['lengthMeters', 'Довжина, м'],
                      ['widthMeters', 'Ширина, м'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`field-${key}`}>{label}</Label>
                      <Input
                        id={`field-${key}`}
                        className="h-11 md:h-11"
                        type="number"
                        min={0.001}
                        max={1000}
                        step="any"
                        value={details[key] ?? ''}
                        onChange={(e) => updateDetail(key, e.target.value)}
                        placeholder="Невідомо"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </form>
          <DialogFooter>
            <Button type="submit" form="add-venue" disabled={pending} className="h-11 px-4">
              {pending ? 'Додаємо поле…' : 'Додати'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
