import { describe, it, expect } from 'vitest';
import { summarizeStars } from './stars.js';

describe('summarizeStars', () => {
  it('has no average until someone rated', () => {
    expect(summarizeStars([])).toEqual({ average: null, count: 0 });
  });
  it('averages received stars to one decimal', () => {
    expect(summarizeStars([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });
});
