# Player Skills & Star Ratings

Changed 2026-10-23: peers rating six categories was too much effort, so skills
became a self-assessment and peer feedback became a single star score.

## Skills — self-assessed

`PACE, DRIBBLING, PASSING, SHOOTING, DEFENDING, PHYSICAL` (SkillType enum).

Each player sets all six themselves on their profile, whole numbers 1–5, and
saves with a button (`players.updateMySkills` → `setOwnSkills` in
`packages/domain/src/skills/self.ts`). New profiles start at 0 = "not set".
`PlayerSkill.ratingsCount` is legacy and no longer updated.

## Star ratings — from co-players

One `Rating` row per `(eventId, raterId, rateeId)` with `stars` 1–5. Optional
for players (they can skip anyone). Immutable.

Rules (enforced in `packages/domain/src/ratings/submit.ts`):

- Event must be FINISHED.
- Only within `RATING_WINDOW_HOURS` (24) after `Event.finishedAt`.
- Rater ≠ ratee; both ATTENDED the same event.
- One rating per rater→ratee per event (domain check + DB unique key).

The legacy per-skill columns on `Rating` (`pace`…`physical`) are nullable and
kept only for history; the 2026-10-23 migration backfilled `stars` with their
rounded average.

## Aggregation — isolated & swappable

The number shown under a player's avatar comes from `starAggregator` in
`packages/domain/src/ratings/stars.ts`, built on the generic aggregator in
`packages/domain/src/skills/aggregate.ts`:

```ts
export interface SkillAggregator {
  aggregate(values: number[]): { value: number; count: number };
}
```

MVP: plain average rounded to 1 decimal (`[5,4,4] → 4.3`). Swap it for a
Bayesian / recency-weighted version without touching callers. Summaries are
computed on read (`starSummariesFor`), not stored.
