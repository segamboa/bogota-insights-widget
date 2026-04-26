import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RADIUS,
  DEFAULT_LANG,
  CACHE_TTL,
  SCORE_THRESHOLDS,
  CATEGORY_COLORS,
  SCORING_WEIGHTS,
} from '../constants.js';

describe('constants', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_RADIUS).toBe(1000);
    expect(DEFAULT_LANG).toBe('es');
  });

  it('cache TTLs are in seconds', () => {
    expect(CACHE_TTL.INSIGHTS).toBe(24 * 60 * 60);
    expect(CACHE_TTL.POIS).toBe(12 * 60 * 60);
  });

  it('score thresholds are ordered', () => {
    expect(SCORE_THRESHOLDS.LOW).toBeLessThan(SCORE_THRESHOLDS.MEDIUM);
    expect(SCORE_THRESHOLDS.MEDIUM).toBeLessThan(SCORE_THRESHOLDS.GOOD);
  });

  it('category colors are valid hex codes', () => {
    const categories = Object.keys(CATEGORY_COLORS);
    expect(categories).toHaveLength(5);
    for (const color of Object.values(CATEGORY_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('scoring weights sum to 1', () => {
    const sum = SCORING_WEIGHTS.count + SCORING_WEIGHTS.proximity + SCORING_WEIGHTS.diversity + SCORING_WEIGHTS.quality;
    expect(sum).toBeCloseTo(1, 2);
  });
});
