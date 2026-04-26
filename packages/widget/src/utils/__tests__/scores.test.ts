import { describe, it, expect } from 'vitest';
import { getScoreColor, formatDistance, isLimitedData, hasNoData } from '../scores.js';

describe('getScoreColor', () => {
  it('returns red for very low scores', () => {
    expect(getScoreColor(30)).toBe('#D93025');
  });

  it('returns dark green for very high scores', () => {
    expect(getScoreColor(85)).toBe('#0D8043');
  });

  it('returns a blended color for boundary scores', () => {
    const color = getScoreColor(37);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(color).not.toBe('#D93025');
    expect(color).not.toBe('#F9AB00');
  });
});

describe('formatDistance', () => {
  it('formats meters', () => {
    expect(formatDistance(500)).toBe('500m');
  });

  it('formats kilometers with one decimal', () => {
    expect(formatDistance(1500)).toBe('1.5km');
  });
});

describe('data availability helpers', () => {
  it('detects limited data', () => {
    expect(isLimitedData(3)).toBe(true);
    expect(isLimitedData(0)).toBe(false);
    expect(isLimitedData(10)).toBe(false);
  });

  it('detects no data', () => {
    expect(hasNoData(0)).toBe(true);
    expect(hasNoData(5)).toBe(false);
  });
});
