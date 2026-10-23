'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';

const SKILLS = [
  ['PACE', 'Швидкість'],
  ['DRIBBLING', 'Дриблінг'],
  ['PASSING', 'Пас'],
  ['SHOOTING', 'Удар'],
  ['DEFENDING', 'Захист'],
  ['PHYSICAL', 'Фізика'],
] as const;

type SkillKey = (typeof SKILLS)[number][0];
type Values = Record<SkillKey, number>;

/** The player rates their own skills 1–5; saved explicitly with a button. */
export function SkillsEditor({ skills }: { skills: { skill: string; value: number }[] }) {
  const utils = trpc.useUtils();
  // Older profiles may hold averages (e.g. 3.4) or 0 = not set yet.
  const initial = Object.fromEntries(
    SKILLS.map(([key]) => [key, Math.round(skills.find((s) => s.skill === key)?.value ?? 0)]),
  ) as Values;
  const [values, setValues] = useState<Values>(initial);

  const dirty = SKILLS.some(([key]) => values[key] !== initial[key]);
  const complete = SKILLS.every(([key]) => values[key] >= 1);

  const save = trpc.players.updateMySkills.useMutation({
    onSuccess: async () => {
      await utils.players.profile.invalidate();
      toast.success('Навички збережено');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground">Мої навички</h2>
        <p className="text-xs text-muted-foreground">Оціни себе чесно — від 1 до 5 зірок</p>
      </div>
      <div className="space-y-3">
        {SKILLS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm">{label}</span>
            <StarRating
              value={values[key]}
              onChange={(v) => setValues((s) => ({ ...s, [key]: v }))}
              className="gap-1"
              starClassName="size-6"
            />
          </div>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={!dirty || !complete || save.isPending}
        onClick={() => save.mutate(values)}
      >
        {save.isPending ? '...' : 'Зберегти'}
      </Button>
      {!complete && (
        <p className="text-center text-xs text-muted-foreground">Заповни всі шість навичок</p>
      )}
    </Card>
  );
}
