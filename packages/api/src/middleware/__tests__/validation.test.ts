/**
 * Tests for validation middleware
 */

import { describe, it, expect } from 'vitest';
import {
  insightsQuerySchema,
  poisQuerySchema,
  isWithinBogota,
} from '../validation.js';
import { BOGOTA_BOUNDS } from '@bogota-insights/shared';

describe('insightsQuerySchema', () => {
  it('should validate valid coordinates', () => {
    const result = insightsQuerySchema.safeParse({
      lat: 4.65,
      lng: -74.08,
      radius: 1000,
      lang: 'es',
    });
    expect(result.success).toBe(true);
  });

  it('should use default values', () => {
    const result = insightsQuerySchema.safeParse({
      lat: 4.65,
      lng: -74.08,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.radius).toBe(1000);
      expect(result.data.lang).toBe('es');
    }
  });

  it('should reject invalid latitude', () => {
    const result = insightsQuerySchema.safeParse({
      lat: 91,
      lng: -74.08,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid longitude', () => {
    const result = insightsQuerySchema.safeParse({
      lat: 4.65,
      lng: 181,
    });
    expect(result.success).toBe(false);
  });

  it('should accept radius within valid range', () => {
    const result100 = insightsQuerySchema.safeParse({ lat: 4.65, lng: -74.08, radius: 100 });
    const result5000 = insightsQuerySchema.safeParse({ lat: 4.65, lng: -74.08, radius: 5000 });
    expect(result100.success).toBe(true);
    expect(result5000.success).toBe(true);
  });

  it('should reject radius below minimum', () => {
    const result = insightsQuerySchema.safeParse({
      lat: 4.65,
      lng: -74.08,
      radius: 50,
    });
    expect(result.success).toBe(false);
  });

  it('should reject radius above maximum', () => {
    const result = insightsQuerySchema.safeParse({
      lat: 4.65,
      lng: -74.08,
      radius: 10000,
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid languages', () => {
    const es = insightsQuerySchema.safeParse({ lat: 4.65, lng: -74.08, lang: 'es' });
    const en = insightsQuerySchema.safeParse({ lat: 4.65, lng: -74.08, lang: 'en' });
    expect(es.success).toBe(true);
    expect(en.success).toBe(true);
  });

  it('should reject invalid language', () => {
    const result = insightsQuerySchema.safeParse({
      lat: 4.65,
      lng: -74.08,
      lang: 'fr',
    });
    expect(result.success).toBe(false);
  });

  it('should coerce string values to numbers', () => {
    const result = insightsQuerySchema.safeParse({
      lat: '4.65',
      lng: '-74.08',
      radius: '1000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.lat).toBe('number');
      expect(typeof result.data.lng).toBe('number');
      expect(result.data.lat).toBe(4.65);
      expect(result.data.lng).toBe(-74.08);
    }
  });
});

describe('poisQuerySchema', () => {
  it('should validate valid POI query', () => {
    const result = poisQuerySchema.safeParse({
      lat: 4.65,
      lng: -74.08,
      radius: 500,
      categories: 'transport,commerce',
    });
    expect(result.success).toBe(true);
  });

  it('should use default radius of 500', () => {
    const result = poisQuerySchema.safeParse({
      lat: 4.65,
      lng: -74.08,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.radius).toBe(500);
    }
  });

  it('should accept optional categories string', () => {
    const withCategories = poisQuerySchema.safeParse({
      lat: 4.65,
      lng: -74.08,
      categories: 'transport,health,education',
    });
    const withoutCategories = poisQuerySchema.safeParse({
      lat: 4.65,
      lng: -74.08,
    });
    expect(withCategories.success).toBe(true);
    expect(withoutCategories.success).toBe(true);
  });
});

describe('isWithinBogota', () => {
  it('should return true for coordinates within Bogota bounds', () => {
    const centro = isWithinBogota(4.65, -74.08);
    const norte = isWithinBogota(4.75, -74.05);
    const sur = isWithinBogota(4.55, -74.10);
    
    expect(centro).toBe(true);
    expect(norte).toBe(true);
    expect(sur).toBe(true);
  });

  it('should return false for coordinates outside Bogota bounds', () => {
    const tooFarNorth = isWithinBogota(5.0, -74.08);
    const tooFarSouth = isWithinBogota(4.0, -74.08);
    const tooFarEast = isWithinBogota(4.65, -73.0);
    const tooFarWest = isWithinBogota(4.65, -75.0);

    expect(tooFarNorth).toBe(false);
    expect(tooFarSouth).toBe(false);
    expect(tooFarEast).toBe(false);
    expect(tooFarWest).toBe(false);
  });

  it('should return true for boundary coordinates', () => {
    const northBound = isWithinBogota(BOGOTA_BOUNDS.north, -74.08);
    const southBound = isWithinBogota(BOGOTA_BOUNDS.south, -74.08);
    const eastBound = isWithinBogota(4.65, BOGOTA_BOUNDS.east);
    const westBound = isWithinBogota(4.65, BOGOTA_BOUNDS.west);

    expect(northBound).toBe(true);
    expect(southBound).toBe(true);
    expect(eastBound).toBe(true);
    expect(westBound).toBe(true);
  });

  it('should handle edge cases', () => {
    expect(isWithinBogota(0, 0)).toBe(false);
    expect(isWithinBogota(-4.65, 74.08)).toBe(false);
  });
});
