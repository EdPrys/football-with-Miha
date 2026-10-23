'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

const SKILLS = [
  ['PACE', 'Швидкість'],
  ['DRIBBLING', 'Дриблінг'],
  ['PASSING', 'Пас'],
  ['SHOOTING', 'Удар'],
  ['DEFENDING', 'Захист'],
  ['PHYSICAL', 'Фізика'],
] as const;

const MIN = 1;
const MAX = 100;
const START = 50; // where a not-yet-filled skill starts in edit mode

type SkillKey = (typeof SKILLS)[number][0];
type Values = Record<SkillKey, number>;

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)));

/** The player rates their own skills 1–100: view mode, then "Редагувати" → save. */
export function SkillsEditor({ skills }: { skills: { skill: string; value: number }[] }) {
  const utils = trpc.useUtils();
  // 0 = not filled in yet.
  const saved = Object.fromEntries(
    SKILLS.map(([key]) => [key, Math.round(skills.find((s) => s.skill === key)?.value ?? 0)]),
  ) as Values;
  const filled = SKILLS.every(([key]) => saved[key] >= MIN);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Values>(saved);
  // Raw text of the number inputs, so the field can be empty while typing.
  const [text, setText] = useState<Record<SkillKey, string>>(
    () => Object.fromEntries(SKILLS.map(([k]) => [k, ''])) as Record<SkillKey, string>,
  );

  const startEditing = () => {
    const start = Object.fromEntries(
      SKILLS.map(([k]) => [k, saved[k] >= MIN ? saved[k] : START]),
    ) as Values;
    setDraft(start);
    setText(
      Object.fromEntries(SKILLS.map(([k]) => [k, String(start[k])])) as Record<SkillKey, string>,
    );
    setEditing(true);
  };

  const setValue = (key: SkillKey, n: number) => {
    const v = clamp(n);
    setDraft((d) => ({ ...d, [key]: v }));
    setText((t) => ({ ...t, [key]: String(v) }));
  };

  const save = trpc.players.updateMySkills.useMutation({
    onSuccess: async () => {
      await utils.players.profile.invalidate();
      toast.success('Навички збережено');
      setEditing(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!editing) {
    return (
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Мої навички</h2>
          {filled && (
            <Button variant="ghost" size="sm" onClick={startEditing}>
              <Pencil />
              Редагувати
            </Button>
          )}
        </div>
        {filled ? (
          <div className="space-y-3">
            {SKILLS.map(([key, label]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-medium tabular-nums">{saved[key]}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${saved[key]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Ще не заповнено. Оціни себе від 1 до 100 — так іншим легше зібрати рівні команди.
            </p>
            <Button className="w-full" onClick={startEditing}>
              Заповнити
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground">Мої навички</h2>
        <p className="text-xs text-muted-foreground">Оціни себе чесно — від 1 до 100</p>
      </div>
      <div className="space-y-4">
        {SKILLS.map(([key, label]) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`skill-${key}`} className="text-sm">
                {label}
              </label>
              <Input
                id={`skill-${key}`}
                type="number"
                inputMode="numeric"
                min={MIN}
                max={MAX}
                value={text[key]}
                onChange={(e) => {
                  setText((t) => ({ ...t, [key]: e.target.value }));
                  const n = Number(e.target.value);
                  if (e.target.value !== '' && Number.isFinite(n)) {
                    setDraft((d) => ({ ...d, [key]: clamp(n) }));
                  }
                }}
                onBlur={() => setValue(key, draft[key])}
                className="w-20 text-right tabular-nums"
              />
            </div>
            <Slider
              value={[draft[key]]}
              min={MIN}
              max={MAX}
              step={1}
              onValueChange={(v) => setValue(key, Array.isArray(v) ? v[0] : v)}
              aria-label={label}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={save.isPending}
          onClick={() => setEditing(false)}
        >
          Скасувати
        </Button>
        <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate(draft)}>
          {save.isPending ? '...' : 'Зберегти'}
        </Button>
      </div>
    </Card>
  );
}
