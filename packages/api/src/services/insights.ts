import ngeohash from 'ngeohash';
import type { CategoryType, InsightsResponse, POI } from '@bogota-insights/shared';
import { CACHE_TTL, DEFAULT_RADIUS } from '@bogota-insights/shared';
import { findPoisWithinRadius, getInsightsCache, setInsightsCache, getPoiCountsBySource } from '../db/queries.js';
import type { PoiRow } from '../db/queries.js';
import { getCache, setCache } from '../cache/redis.js';
import { computeCategoryScore, computeOverallScore, generateCategorySummary } from './scoring.js';

const CATEGORIES: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];

interface GetInsightsOptions {
  lat: number;
  lng: number;
  radiusM?: number;
  lang?: string;
}

/**
 * Main insights pipeline.
 * 1. Check Redis cache
 * 2. Check PostgreSQL insights_cache
 * 3. Compute from scratch using POIs table
 */
export async function getInsights(opts: GetInsightsOptions): Promise<InsightsResponse & { _cacheHit: boolean }> {
  const { lat, lng, lang = 'es' } = opts;
  const radiusM = opts.radiusM ?? DEFAULT_RADIUS;

  // Compute geohash-6 for cache key
  const geohash = ngeohash.encode(lat, lng, 6);
  const redisCacheKey = `insights:${geohash}:${radiusM}:${lang}`;

  // Step 1: Check Redis
  const cached = await getCache(redisCacheKey);
  if (cached) {
    const parsed = JSON.parse(cached) as InsightsResponse;
    return { ...parsed, _cacheHit: true };
  }

  // Step 2: Check PostgreSQL insights_cache
  const dbCached = await getInsightsCache(geohash, radiusM, lang);
  if (dbCached) {
    const response = buildResponseFromCache(dbCached, lat, lng, radiusM, true);
    // Populate Redis for next time
    await setCache(redisCacheKey, JSON.stringify(response), CACHE_TTL.INSIGHTS);
    return { ...response, _cacheHit: true };
  }

  // Step 3: Compute from scratch
  const allPois = await findPoisWithinRadius(lng, lat, radiusM);

  // Group by category
  const poisByCategory: Record<string, PoiRow[]> = {};
  for (const poi of allPois) {
    if (!poisByCategory[poi.category]) {
      poisByCategory[poi.category] = [];
    }
    poisByCategory[poi.category].push(poi);
  }

  // Compute scores per category
  const scores: Record<string, number> = {};
  const categories: Record<string, any> = {};

  for (const category of CATEGORIES) {
    const categoryPois = poisByCategory[category] || [];
    const scoreResult = computeCategoryScore(category, categoryPois, radiusM);
    scores[category] = scoreResult.score;

    // Build counts
    const counts: Record<string, number> = {};
    for (const poi of categoryPois) {
      counts[poi.subcategory] = (counts[poi.subcategory] || 0) + 1;
    }

    // Build POI list (top 20 closest)
    const topPois: POI[] = categoryPois.slice(0, 20).map((p) => ({
      id: String(p.id),
      name: p.name || p.name_es || 'Sin nombre',
      type: p.subcategory,
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      distance_m: Math.round(p.distance_m),
      source: p.source as POI['source'],
      tags: p.source_tags as Record<string, string>,
    }));

    categories[category] = {
      score: scoreResult.score,
      summary: generateCategorySummary(category, scoreResult.score, categoryPois.length, lang),
      pois: topPois,
      counts,
    };
  }

  // Overall score
  scores.overall = computeOverallScore(scores as Record<CategoryType, number>);

  // Source coverage
  const sourceCounts: Record<string, number> = {};
  for (const poi of allPois) {
    sourceCounts[poi.source] = (sourceCounts[poi.source] || 0) + 1;
  }

  const response: InsightsResponse = {
    location: {
      lat,
      lng,
      address: undefined,
      neighborhood: undefined,
    },
    scores: {
      overall: scores.overall,
      transport: scores.transport || 0,
      commerce: scores.commerce || 0,
      education: scores.education || 0,
      health: scores.health || 0,
      recreation: scores.recreation || 0,
    },
    categories: categories as Record<CategoryType, any>,
    meta: {
      data_timestamp: new Date().toISOString(),
      radius_m: radiusM,
      cache_hit: false,
      sources: Object.keys(sourceCounts),
    },
  };

  // Store in PostgreSQL cache
  await setInsightsCache(
    geohash,
    radiusM,
    lang,
    response.scores,
    categories,
    { address: response.location.address, neighborhood: response.location.neighborhood },
    sourceCounts,
    24,
  );

  // Store in Redis
  await setCache(redisCacheKey, JSON.stringify(response), CACHE_TTL.INSIGHTS);

  return { ...response, _cacheHit: false };
}

function buildResponseFromCache(
  dbCache: any,
  lat: number,
  lng: number,
  radiusM: number,
  cacheHit: boolean,
): InsightsResponse {
  return {
    location: {
      lat,
      lng,
      address: dbCache.location_meta?.address,
      neighborhood: dbCache.location_meta?.neighborhood,
    },
    scores: dbCache.scores,
    categories: dbCache.pois_summary as Record<CategoryType, any>,
    meta: {
      data_timestamp: dbCache.computed_at,
      radius_m: radiusM,
      cache_hit: cacheHit,
      sources: Object.keys(dbCache.source_coverage || {}),
    },
  };
}
