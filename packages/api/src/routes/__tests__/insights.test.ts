/**
 * Tests for insights routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { insightsRoutes } from '../insights.js';
import type { CategoryType, CategoryScore } from '@bogota-insights/shared';

function mockCategories(): Record<CategoryType, CategoryScore> {
  const cats: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];
  const result = {} as Record<CategoryType, CategoryScore>;
  for (const cat of cats) {
    result[cat] = {
      score: 70,
      summary: 'Good',
      pois: [],
      counts: {},
    };
  }
  return result;
}

// Mock the insights service
vi.mock('../../services/insights.js', () => ({
  getInsights: vi.fn(),
}));

import { getInsights } from '../../services/insights.js';

describe('insightsRoutes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify();
    app.register(insightsRoutes);
    vi.clearAllMocks();
  });

  it('should return 400 for invalid coordinates', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/insights?lat=invalid&lng=-74.08',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_COORDINATES');
  });

  it('should return 400 for coordinates outside Bogota', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/insights?lat=10&lng=-74.08',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('OUTSIDE_COVERAGE');
  });

  it('should return insights for valid coordinates', async () => {
    const mockInsights = {
      location: { lat: 4.65, lng: -74.08, neighborhood: 'Test' },
      scores: { overall: 75, transport: 80, commerce: 70, education: 60, health: 90, recreation: 50 },
      categories: mockCategories(),
      meta: { data_timestamp: new Date().toISOString(), radius_m: 1000, cache_hit: false, sources: ['test'] },
      _cacheHit: false,
    };

    vi.mocked(getInsights).mockResolvedValue(mockInsights);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/insights?lat=4.65&lng=-74.08',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.location.lat).toBe(4.65);
    expect(body.location.lng).toBe(-74.08);
    expect(body.scores.overall).toBe(75);
  });

  it('should accept custom radius parameter', async () => {
    const mockInsights = {
      location: { lat: 4.65, lng: -74.08 },
      scores: { overall: 75, transport: 80, commerce: 70, education: 60, health: 90, recreation: 50 },
      categories: mockCategories(),
      meta: { data_timestamp: new Date().toISOString(), radius_m: 500, cache_hit: false, sources: ['test'] },
      _cacheHit: false,
    };

    vi.mocked(getInsights).mockResolvedValue(mockInsights);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/insights?lat=4.65&lng=-74.08&radius=500',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.meta.radius_m).toBe(500);
  });

  it('should accept language parameter', async () => {
    const mockInsights = {
      location: { lat: 4.65, lng: -74.08 },
      scores: { overall: 75, transport: 80, commerce: 70, education: 60, health: 90, recreation: 50 },
      categories: mockCategories(),
      meta: { data_timestamp: new Date().toISOString(), radius_m: 1000, cache_hit: false, sources: ['test'] },
      _cacheHit: false,
    };

    vi.mocked(getInsights).mockResolvedValue(mockInsights);

    const responseEs = await app.inject({
      method: 'GET',
      url: '/v1/insights?lat=4.65&lng=-74.08&lang=es',
    });

    const responseEn = await app.inject({
      method: 'GET',
      url: '/v1/insights?lat=4.65&lng=-74.08&lang=en',
    });

    expect(responseEs.statusCode).toBe(200);
    expect(responseEn.statusCode).toBe(200);
  });

  it('should return 500 on service error', async () => {
    vi.mocked(getInsights).mockRejectedValue(new Error('Service error'));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/insights?lat=4.65&lng=-74.08',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
