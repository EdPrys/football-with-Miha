'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerAvatar } from '@/components/player-avatar';
import { StarRow, type StarSummary } from '@/components/star-row';

export type InviteCandidate = {
  id: string;
  name: string;
  avatarUrl: string | null;
  stars: StarSummary;
};

/**
 * Checklist of players to invite (from the game's city). Controlled:
 * `selected` holds the chosen user ids.
 */
export function InvitePlayers({
  players,
  loading,
  cityName,
  selected,
  onChange,
}: {
  players: InviteCandidate[] | undefined;
  loading: boolean;
  cityName: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');

  if (loading) return <Skeleton className="h-24 w-full rounded-lg" />;
  const all = players ?? [];
  if (all.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        У місті {cityName} немає гравців, яких ще можна запросити.
      </p>
    );

  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
  const allSelected = all.every((p) => selected.includes(p.id));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Гравці з міста {cityName} · обрано {selected.length}
        </p>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-xs"
          onClick={() => onChange(allSelected ? [] : all.map((p) => p.id))}
        >
          {allSelected ? 'Зняти всіх' : 'Обрати всіх'}
        </Button>
      </div>
      {all.length > 8 && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук за ім'ям"
        />
      )}
      <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border p-1">
        {shown.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"
          >
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={selected.includes(p.id)}
              onChange={() => toggle(p.id)}
            />
            <PlayerAvatar name={p.name} url={p.avatarUrl} className="size-8 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
            <StarRow stars={p.stars} />
          </label>
        ))}
        {shown.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">Нікого не знайдено</p>
        )}
      </div>
    </div>
  );
}
