import { describe, it, expect } from 'vitest';
import { APIError, getMockData } from '../api.js';

describe('APIError', () => {
  it('stores code and message', () => {
    const err = new APIError('RATE_LIMIT', 'Too many requests');
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.message).toBe('Too many requests');
    expect(err.name).toBe('APIError');
  });
});

describe('getMockData', () => {
  it('returns a valid InsightsResponse structure', () => {
    const data = getMockData(4.65, -74.08, 1000);
    expect(data.location.lat).toBe(4.65);
    expect(data.location.lng).toBe(-74.08);
    expect(data.scores.overall).toBe(74);
    expect(Object.keys(data.categories)).toHaveLength(5);
    expect(data.meta.radius_m).toBe(1000);
  });
});
