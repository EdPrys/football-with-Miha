'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { formationOptionsFor } from '@/lib/formation';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function NewEventPage() {
  const router = useRouter();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const venues = trpc.venues.list.useQuery();

  const [fieldId, setFieldId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('22:00');
  const [numberOfTeams, setNumberOfTeams] = useState('2');
  const [playersPerTeam, setPlayersPerTeam] = useState('5');
  const [formation, setFormation] = useState(formationOptionsFor(5)[0].key);

  const formationOptions = useMemo(
    () => formationOptionsFor(Number(playersPerTeam) || 1),
    [playersPerTeam],
  );

  // Reset formation to the default whenever it no longer belongs to the current team size.
  useEffect(() => {
    if (!formationOptions.some((o) => o.key === formation)) {
      setFormation(formationOptions[0].key);
    }
  }, [formationOptions, formation]);

  const create = trpc.events.create.useMutation({
    onSuccess: (d) => {
      toast.success('Гру створено!');
      router.push(`/events/${d.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const fields = useMemo(
    () => (venues.data ?? []).flatMap((v) => v.fields.map((f) => ({ ...f, venue: v.name }))),
    [venues.data],
  );

  if (me.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!me.data)
    return (
      <Card className="space-y-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">Увійди, щоб створювати ігри.</p>
        <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
          Увійти
        </Link>
      </Card>
    );
  if (me.data.user.role === 'PLAYER')
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Тільки менеджери можуть створювати ігри.
      </Card>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!fieldId || !date) return toast.error('Оберіть поле і дату');
    const startAt = new Date(`${date}T${startTime}`);
    const endAt = new Date(`${date}T${endTime}`);
    create.mutate({
      fieldId,
      startAt,
      endAt,
      numberOfTeams: Number(numberOfTeams),
      playersPerTeam: Number(playersPerTeam),
      formation,
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Створити гру</h1>
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Поле</Label>
            <Select value={fieldId} onValueChange={(v) => setFieldId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Оберіть поле">
                  {(id: string) => {
                    const f = fields.find((x) => x.id === id);
                    return f ? `${f.venue} · ${f.name}` : null;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.venue} · {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Дата</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Початок</Label>
              <Input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">Кінець</Label>
              <Input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="teams">Команд</Label>
              <Input
                id="teams"
                type="number"
                min={2}
                value={numberOfTeams}
                onChange={(e) => setNumberOfTeams(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="per">Гравців у команді</Label>
              <Input
                id="per"
                type="number"
                min={1}
                value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(e.target.value)}
              />
            </div>
          </div>
          {formationOptions.length > 1 && (
            <div className="space-y-1.5">
              <Label>Формація (захист-півзахист-напад)</Label>
              <Select value={formation} onValueChange={(v) => v && setFormation(v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(key: string) => {
                      const o = formationOptions.find((x) => x.key === key);
                      return o
                        ? `${o.key} · воротар + ${o.slots.DEF}-${o.slots.MID}-${o.slots.FWD}`
                        : key;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {formationOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.key} · воротар + {o.slots.DEF}-{o.slots.MID}-{o.slots.FWD}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? '...' : 'Створити'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
