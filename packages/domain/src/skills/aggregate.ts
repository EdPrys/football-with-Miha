export interface SkillAggregate {
  value: number;
  count: number;
}

/**
 * Turns the raw rating values a player received for ONE skill into the stored
 * aggregate. Swap the implementation (Bayesian, weighted, recency) without
 * touching callers — this is the only place the formula lives.
 */
export interface SkillAggregator {
  aggregate(values: number[]): SkillAggregate;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** MVP algorithm: plain average, rounded to 1 decimal. */
export const averageAggregator: SkillAggregator = {
  aggregate(values: number[]): SkillAggregate {
    const count = values.length;
    if (count === 0) return { value: 0, count: 0 };
    const mean = values.reduce((sum, v) => sum + v, 0) / count;
    return { value: round1(mean), count };
  },
};

/** The aggregator the app currently uses. Change here to swap globally. */
export const skillAggregator: SkillAggregator = averageAggregator;
