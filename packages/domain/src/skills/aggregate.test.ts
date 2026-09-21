import { describe, it, expect } from 'vitest';
import { averageAggregator } from './aggregate.js';

describe('averageAggregator', () => {
  it('returns zero for no ratings', () => {
    expect(averageAggregator.aggregate([])).toEqual({ value: 0, count: 0 });
  });

  it('averages and rounds to 1 decimal', () => {
    // [4,5,4,4,5] -> mean 4.4 (example from the product plan)
    expect(averageAggregator.aggregate([4, 5, 4, 4, 5])).toEqual({ value: 4.4, count: 5 });
  });

  it('counts every rating used', () => {
    expect(averageAggregator.aggregate([1, 2, 3])).toEqual({ value: 2, count: 3 });
  });

  it('rounds half correctly', () => {
    // mean = 3.75 -> 3.8
    expect(averageAggregator.aggregate([3, 4, 4, 4]).value).toBe(3.8);
  });
});
