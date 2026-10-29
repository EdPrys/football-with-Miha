# Player Skills & Star Ratings

Changed 2026-10-23: peers rating six categories was too much effort, so skills
became a self-assessment and peer feedback became a single star score.

## Skills — self-assessed

`PACE, DRIBBLING, PASSING, SHOOTING, DEFENDING, PHYSICAL` (SkillType enum).

Each player sets all six themselves on their profile, whole numbers 1–100
(slider + number field, "Редагувати" → "Зберегти"; the 2026-10-23 migration
scaled earlier 1–5 values ×20) (`players.updateMySkills` → `setOwnSkills` in
`packages/domain/src/skills/self.ts`). New profiles start at 0 = "not set".
`PlayerSkill.ratingsCount` is legacy and no longer updated.

## Star ratings — from co-players

One `Rating` row per `(eventId, raterId, rateeId)` with `stars` 1–5. Optional
for players (they can skip anyone). Immutable. After the game the rater sees
every co-player in one list and submits them together (`submitRatings`); a
player left at 0 stars is not rated at all — 0 never counts toward the average.

Rules (enforced in `packages/domain/src/ratings/submit.ts`):

- Event must be FINISHED.
- Only within `RATING_WINDOW_HOURS` (24) after `Event.finishedAt`.
- Rater ≠ ratee; both ATTENDED the same event.
- One rating per rater→ratee per event (domain check + DB unique key).
- A batch is all-or-nothing: one invalid rating rejects the whole list.

The legacy per-skill columns on `Rating` (`pace`…`physical`) are nullable and
kept only for history; the 2026-10-23 migration backfilled `stars` with their
rounded average.

## Aggregation — isolated & swappable

Shown under the avatar as a 5-star row filled in proportion to the average
(3.4 → three full stars, the fourth 40% filled). The number comes from `starAggregator` in
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

## MVP of the match

Every ATTENDED player has one MVP vote per finished game (not for themselves),
in the same 24h window as stars (`packages/domain/src/mvp/mvp.ts`). Most votes
wins; on a tie every tied player is MVP. Voting closes early once all players
voted, otherwise the scheduler (`resolveDueMvps`) closes it after 24h. Winners
are rows in `EventMvp`; a player's MVP count = number of their rows, shown as a
👑N badge on the avatar.
