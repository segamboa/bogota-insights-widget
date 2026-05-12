import ngeohash from 'ngeohash';
import type { CategoryType, InsightsResponse, POI } from '@bogota-insights/shared';
import { CACHE_TTL, DEFAULT_RADIUS } from '@bogota-insights/shared';
import { findPoisWithinRadius, getInsightsCache, setInsightsCache, getPoiCountsBySource } from '../db/queries.js';
import type { PoiRow } from '../db/queries.js';
import { getCache, setCache } from '../cache/redis.js';
import { computeCategoryScore, computeOverallScore, generateCategorySummary } from './scoring.js';
import { getAllPercentiles, getAllLocalContext } from './percentiles.js';
import { computeInvestmentScore } from './investment.js';
import { getPreviousScoreSnapshot } from '../db/queries.js';
import { getNeighborhood } from './reverse-geocode.js';

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

  // Compute overall score
  scores.overall = computeOverallScore(scores as Record<CategoryType, number>);

  // Add percentile context (growth-oriented framing)
  const percentiles = getAllPercentiles(scores);
  const localContext = getAllLocalContext(lat, lng, scores, 3);

  for (const category of [...CATEGORIES, 'overall']) {
    const catKey = category as CategoryType | 'overall';
    const pctx = percentiles[category];
    const lctx = localContext[category];
    if (categories[category]) {
      if (pctx) {
        categories[category].percentile = pctx.percentile;
        categories[category].cityMedian = pctx.cityMedian;
      }
      if (lctx) {
        categories[category].localMedian = lctx.localMedian;
        categories[category].localPercentile = lctx.localPercentile;
      }
    }
  }

  // Add trend data from previous snapshot
  const previousSnapshot = await getPreviousScoreSnapshot(lat, lng, radiusM);
  if (previousSnapshot) {
    const monthsAgo = Math.max(
      1,
      Math.round((Date.now() - new Date(previousSnapshot.recorded_at).getTime()) / (1000 * 60 * 60 * 24 * 30)),
    );
    for (const category of [...CATEGORIES, 'overall']) {
      const prevScore = previousSnapshot.scores[category];
      const currScore = scores[category];
      if (prevScore !== undefined && categories[category]) {
        const delta = Math.round(currScore - prevScore);
        let direction: 'up' | 'down' | 'stable' = 'stable';
        if (delta > 2) direction = 'up';
        else if (delta < -2) direction = 'down';
        categories[category].trend = { direction, delta, monthsAgo };
      }
    }
  }

  // Compute investment / growth potential score
  const trendingUpCount = [...CATEGORIES, 'overall'].filter(
    (c) => categories[c]?.trend?.direction === 'up',
  ).length;

  const investmentInputs = {
    overall: scores.overall,
    scores,
    cityMedians: Object.fromEntries(
      CATEGORIES.map((c) => [c, percentiles[c]?.cityMedian ?? 50]),
    ),
    categoryPois: Object.fromEntries(
      CATEGORIES.map((c) => [c, poisByCategory[c]?.map((p) => ({ subcategory: p.subcategory, distance_m: p.distance_m })) || []]),
    ),
    trendingUpCount,
    radiusM,
  };
  const investment = computeInvestmentScore(investmentInputs);

  // Resolve neighborhood name (async, cached)
  const neighborhood = await getNeighborhood(lat, lng);

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
      neighborhood: neighborhood || undefined,
    },
    scores: {
      overall: scores.overall,
      transport: scores.transport || 0,
      commerce: scores.commerce || 0,
      education: scores.education || 0,
      health: scores.health || 0,
      recreation: scores.recreation || 0,
      investment: investment.score,
    },
    categories: categories as Record<CategoryType, any>,
    investment,
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
    investment as unknown as Record<string, unknown>,
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
  const scores = dbCache.scores || {};
  const categories = dbCache.pois_summary as Record<CategoryType, any>;

  return {
    location: {
      lat,
      lng,
      address: dbCache.location_meta?.address,
      neighborhood: dbCache.location_meta?.neighborhood,
    },
    scores: {
      overall: scores.overall || 0,
      transport: scores.transport || 0,
      commerce: scores.commerce || 0,
      education: scores.education || 0,
      health: scores.health || 0,
      recreation: scores.recreation || 0,
      investment: scores.investment || 0,
    },
    categories,
    investment: dbCache.investment || { score: 0, summary: '', signal: 'watch' },
    meta: {
      data_timestamp: dbCache.computed_at,
      radius_m: radiusM,
      cache_hit: cacheHit,
      sources: Object.keys(dbCache.source_coverage || {}),
    },
  };
}
