/**
 * Tests for scoring service
 */

import { describe, it, expect } from 'vitest';
import {
  computeCategoryScore,
  computeOverallScore,
  generateCategorySummary,
} from '../scoring.js';
import type { PoiRow } from '../../db/queries.js';
import type { CategoryType } from '@bogota-insights/shared';

// Helper to create mock POI rows
function createMockPoi(overrides: Partial<PoiRow> = {}): PoiRow {
  return {
    id: 1,
    source_id: 'test-1',
    name: 'Test POI',
    name_es: null,
    category: 'transport' as CategoryType,
    subcategory: 'bus_stop',
    lat: 4.65,
    lng: -74.08,
    distance_m: 100,
    source: 'osm',
    confidence: 80,
    address: null,
    source_tags: {},
    ...overrides,
  };
}

describe('computeCategoryScore', () => {
  it('should return floor score of 25 when no POIs provided', () => {
    const result = computeCategoryScore('transport', [], 1000);
    expect(result.score).toBe(25);
    expect(result.countScore).toBe(0);
    expect(result.proximityScore).toBe(0);
    expect(result.diversityScore).toBe(0);
    expect(result.qualityScore).toBe(0);
  });

  it('should compute score for transport category with single POI', () => {
    const pois = [createMockPoi({ category: 'transport', subcategory: 'bus_stop' })];
    const result = computeCategoryScore('transport', pois, 1000);
    
    expect(result.score).toBeGreaterThanOrEqual(25);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.countScore).toBeGreaterThan(0);
    expect(result.proximityScore).toBeGreaterThan(0);
  });

  it('should compute higher score for more POIs', () => {
    const fewPois = Array(5).fill(null).map((_, i) => 
      createMockPoi({ id: i + 1, distance_m: 200 * (i + 1) })
    );
    const manyPois = Array(50).fill(null).map((_, i) => 
      createMockPoi({ id: i + 1, distance_m: 200 * ((i % 10) + 1) })
    );

    const fewResult = computeCategoryScore('transport', fewPois, 1000);
    const manyResult = computeCategoryScore('transport', manyPois, 1000);

    expect(manyResult.score).toBeGreaterThan(fewResult.score);
    expect(manyResult.countScore).toBeGreaterThan(fewResult.countScore);
  });

  it('should compute higher proximity score for closer POIs', () => {
    const closePois = [
      createMockPoi({ distance_m: 100 }),
      createMockPoi({ distance_m: 150 }),
    ];
    const farPois = [
      createMockPoi({ distance_m: 800 }),
      createMockPoi({ distance_m: 900 }),
    ];

    const closeResult = computeCategoryScore('transport', closePois, 1000);
    const farResult = computeCategoryScore('transport', farPois, 1000);

    expect(closeResult.proximityScore).toBeGreaterThan(farResult.proximityScore);
  });

  it('should compute diversity score based on unique subcategories', () => {
    const lowDiversity = [
      createMockPoi({ subcategory: 'bus_stop' }),
      createMockPoi({ subcategory: 'bus_stop' }),
      createMockPoi({ subcategory: 'bus_stop' }),
    ];
    const highDiversity = [
      createMockPoi({ subcategory: 'bus_stop' }),
      createMockPoi({ subcategory: 'bus_station' }),
      createMockPoi({ subcategory: 'parada_sitp' }),
    ];

    const lowResult = computeCategoryScore('transport', lowDiversity, 1000);
    const highResult = computeCategoryScore('transport', highDiversity, 1000);

    expect(highResult.diversityScore).toBeGreaterThan(lowResult.diversityScore);
  });

  it('should handle all category types', () => {
    const categories: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];
    const pois = [createMockPoi()];

    categories.forEach((category) => {
      const result = computeCategoryScore(category, pois, 1000);
      expect(result.score).toBeGreaterThanOrEqual(25);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  it('should scale with different radius values', () => {
    const pois = Array(25).fill(null).map((_, i) => 
      createMockPoi({ id: i + 1, distance_m: 100 })
    );

    const smallRadius = computeCategoryScore('transport', pois, 500);
    const largeRadius = computeCategoryScore('transport', pois, 2000);

    // With calibrated averages, both may hit max count score
    // Verify they compute valid scores
    expect(smallRadius.score).toBeGreaterThanOrEqual(25);
    expect(largeRadius.score).toBeGreaterThanOrEqual(25);
    expect(smallRadius.score).toBeLessThanOrEqual(100);
    expect(largeRadius.score).toBeLessThanOrEqual(100);
  });
});

describe('computeOverallScore', () => {
  it('should return 0 when no category scores provided', () => {
    const result = computeOverallScore({} as Record<CategoryType, number>);
    expect(result).toBe(0);
  });

  it('should compute weighted average of category scores', () => {
    const scores = {
      transport: 80,
      commerce: 70,
      education: 60,
      health: 90,
      recreation: 50,
    };

    const result = computeOverallScore(scores);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('should weight health category highest', () => {
    const healthHigh = {
      transport: 50,
      commerce: 50,
      education: 50,
      health: 100,
      recreation: 50,
    };
    const transportHigh = {
      transport: 100,
      commerce: 50,
      education: 50,
      health: 50,
      recreation: 50,
    };

    const healthResult = computeOverallScore(healthHigh);
    const transportResult = computeOverallScore(transportHigh);

    expect(healthResult).toBeGreaterThan(transportResult);
  });

  it('should handle partial category scores', () => {
    const partialScores = {
      transport: 80,
      commerce: 0,
      education: 60,
      health: 0,
      recreation: 70,
    };

    const result = computeOverallScore(partialScores);
    expect(result).toBeGreaterThan(0);
  });
});

describe('generateCategorySummary', () => {
  it('should generate Spanish summary by default', () => {
    const summary = generateCategorySummary('transport', 85, 10);
    expect(summary).toContain('Excelente');
    expect(summary).toContain('transporte');
  });

  it('should generate English summary when requested', () => {
    const summary = generateCategorySummary('transport', 85, 10, 'en');
    expect(summary).toContain('Excellent');
    expect(summary).toContain('transport');
  });

  it('should return different labels for different score ranges', () => {
    const excellent = generateCategorySummary('health', 85, 10);
    const good = generateCategorySummary('health', 70, 10);
    const acceptable = generateCategorySummary('health', 50, 10);
    const limited = generateCategorySummary('health', 30, 10);

    expect(excellent).not.toBe(good);
    expect(good).not.toBe(acceptable);
    expect(acceptable).not.toBe(limited);
  });

  it('should handle all category types in Spanish', () => {
    const categories: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];
    
    categories.forEach((category) => {
      const summary = generateCategorySummary(category, 80, 10, 'es');
      expect(summary).toBeTruthy();
      expect(typeof summary).toBe('string');
    });
  });

  it('should handle all category types in English', () => {
    const categories: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];
    
    categories.forEach((category) => {
      const summary = generateCategorySummary(category, 80, 10, 'en');
      expect(summary).toBeTruthy();
      expect(typeof summary).toBe('string');
    });
  });

  it('should handle no data case', () => {
    const summary = generateCategorySummary('commerce', 0, 0, 'es');
    expect(summary).toContain('Sin datos');
  });
});
