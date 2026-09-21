# Player Skills & Rating Aggregation

Skills are **derived**, never user-set. They are computed from ratings other participants submit after an event.

## Skills

`PACE, DRIBBLING, PASSING, SHOOTING, DEFENDING, PHYSICAL` (SkillType enum).
Each skill for a player exposes: `value` (aggregate) and `ratingsCount` (how many ratings fed it).

## Rating

One `Rating` row per `(eventId, raterId, rateeId)` — a single submission scoring all six categories 1–5. Immutable in MVP.

Rules (enforced in domain):

- Event must be FINISHED.
- Rater ≠ ratee.
- Both must be participants of the same event (status ATTENDED for MVP eligibility).
- One rating per rater→ratee per event.

## Aggregation — isolated & swappable

The algorithm lives in `packages/domain/src/skills/aggregate.ts` behind a single interface:

```ts
export interface SkillAggregator {
  // Given all rating values a player received for one skill, return the stored value.
  aggregate(values: number[]): { value: number; count: number };
}
```

### MVP implementation: plain average

```
value = round1(mean(values))   // e.g. [4,5,4,4,5] -> 4.4
count = values.length
```

Recompute a player's `PlayerSkill` rows whenever a new rating referencing them is submitted.

### Future implementations (swap only this file)

- Weighted by rater reliability
- Bayesian average (pull toward a prior until enough samples)
- Recency weighting (recent matches count more)
- Minimum-ratings threshold before a skill is shown
- Confidence interval / progression over time

Callers depend only on `SkillAggregator`; changing the formula must not touch procedures or the profile screen.
