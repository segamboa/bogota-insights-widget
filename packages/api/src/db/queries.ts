import { query } from './connection.js';
import type { CategoryType } from '@bogota-insights/shared';

export interface PoiRow {
  id: number;
  source: string;
  source_id: string;
  category: CategoryType;
  subcategory: string;
  name: string | null;
  name_es: string | null;
  address: string | null;
  confidence: number;
  distance_m: number;
  lat: number;
  lng: number;
  source_tags: Record<string, unknown>;
}

export interface InsightsCacheRow {
  id: number;
  geohash: string;
  radius_m: number;
  lang: string;
  scores: Record<string, number>;
  pois_summary: Record<string, unknown>;
  location_meta: Record<string, unknown>;
  source_coverage: Record<string, number>;
  computed_at: Date;
  expires_at: Date;
}

/**
 * Find all canonical POIs within a radius of a point, grouped by category.
 */
export async function findPoisWithinRadius(
  lng: number,
  lat: number,
  radiusM: number,
  category?: CategoryType,
): Promise<PoiRow[]> {
  const params: any[] = [lng, lat, radiusM];
  let categoryFilter = '';
  if (category) {
    categoryFilter = 'AND category = $4';
    params.push(category);
  }

  const result = await query<PoiRow>(
    `SELECT
      id, source, source_id, category, subcategory,
      COALESCE(name_es, name) AS name, name_es, address, confidence,
      ST_Distance(location, ST_MakePoint($1, $2)::geography) AS distance_m,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      source_tags
    FROM pois
    WHERE is_canonical = TRUE
      ${categoryFilter}
      AND ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
    ORDER BY distance_m ASC
    LIMIT 200`,
    params,
  );

  return result.rows;
}

/**
 * Find POIs within radius for a specific category.
 */
export async function findPoisByCategory(
  lng: number,
  lat: number,
  radiusM: number,
  category: CategoryType,
): Promise<PoiRow[]> {
  return findPoisWithinRadius(lng, lat, radiusM, category);
}

/**
 * Get category counts within radius.
 */
export async function getCategoryCounts(
  lng: number,
  lat: number,
  radiusM: number,
): Promise<Record<CategoryType, { total: number; subcategories: Record<string, number> }>> {
  const result = await query(
    `SELECT
      category,
      subcategory,
      COUNT(*) AS count
    FROM pois
    WHERE is_canonical = TRUE
      AND ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
    GROUP BY category, subcategory
    ORDER BY category, count DESC`,
    [lng, lat, radiusM],
  );

  const counts: Record<string, { total: number; subcategories: Record<string, number> }> = {};
  for (const row of result.rows) {
    if (!counts[row.category]) {
      counts[row.category] = { total: 0, subcategories: {} };
    }
    const c = parseInt(row.count, 10);
    counts[row.category].total += c;
    counts[row.category].subcategories[row.subcategory] = c;
  }
  return counts as Record<CategoryType, { total: number; subcategories: Record<string, number> }>;
}

/**
 * Look up cached insights for a geohash.
 */
export async function getInsightsCache(
  geohash: string,
  radiusM: number,
  lang: string,
): Promise<InsightsCacheRow | null> {
  const result = await query<InsightsCacheRow>(
    `SELECT * FROM insights_cache
     WHERE geohash = $1 AND radius_m = $2 AND lang = $3
       AND expires_at > NOW()
     LIMIT 1`,
    [geohash, radiusM, lang],
  );
  return result.rows[0] ?? null;
}

/**
 * Store computed insights in the cache.
 */
export async function setInsightsCache(
  geohash: string,
  radiusM: number,
  lang: string,
  scores: Record<string, number>,
  poisSummary: Record<string, unknown>,
  locationMeta: Record<string, unknown>,
  sourceCoverage: Record<string, number>,
  ttlHours: number = 24,
): Promise<void> {
  await query(
    `INSERT INTO insights_cache (geohash, radius_m, lang, scores, pois_summary, location_meta, source_coverage, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '1 hour' * $8)
     ON CONFLICT (geohash, radius_m, lang)
     DO UPDATE SET
       scores = EXCLUDED.scores,
       pois_summary = EXCLUDED.pois_summary,
       location_meta = EXCLUDED.location_meta,
       source_coverage = EXCLUDED.source_coverage,
       computed_at = NOW(),
       expires_at = NOW() + INTERVAL '1 hour' * $8`,
    [geohash, radiusM, lang, JSON.stringify(scores), JSON.stringify(poisSummary), JSON.stringify(locationMeta), JSON.stringify(sourceCoverage), ttlHours],
  );
}

/**
 * Upsert POIs from a data source.
 */
export async function upsertPoi(
  source: string,
  sourceId: string,
  sourceDataset: string | null,
  category: CategoryType,
  subcategory: string,
  name: string | null,
  nameEs: string | null,
  lng: number,
  lat: number,
  address: string | null,
  confidence: number,
  sourceTags: Record<string, unknown>,
  sourceUpdatedAt: Date | null,
): Promise<{ id: number; isNew: boolean }> {
  const result = await query(
    `INSERT INTO pois (source, source_id, source_dataset, category, subcategory,
                       name, name_es, location, address, confidence, source_tags, source_updated_at, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7,
             ST_MakePoint($8, $9)::geography,
             $10, $11, $12, $13, NOW())
     ON CONFLICT (source, source_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       name_es = EXCLUDED.name_es,
       location = EXCLUDED.location,
       address = EXCLUDED.address,
       confidence = EXCLUDED.confidence,
       source_tags = EXCLUDED.source_tags,
       source_updated_at = EXCLUDED.source_updated_at,
       synced_at = NOW()
     RETURNING id, (xmax = 0) AS is_new`,
    [source, sourceId, sourceDataset, category, subcategory, name, nameEs, lng, lat, address, confidence, JSON.stringify(sourceTags), sourceUpdatedAt],
  );

  return {
    id: result.rows[0].id,
    isNew: result.rows[0].is_new,
  };
}

/**
 * Record a sync run.
 */
export async function createSyncRun(
  source: string,
  syncType: string,
): Promise<number> {
  const result = await query(
    `INSERT INTO sync_runs (source, sync_type) VALUES ($1, $2) RETURNING id`,
    [source, syncType],
  );
  return result.rows[0].id;
}

/**
 * Update sync run with results.
 */
export async function completeSyncRun(
  id: number,
  status: string,
  metrics: {
    records_fetched?: number;
    records_created?: number;
    records_updated?: number;
    records_deleted?: number;
    duplicates_found?: number;
  },
  errorMessage?: string,
  errorDetails?: Record<string, unknown>,
): Promise<void> {
  await query(
    `UPDATE sync_runs SET
       status = $2,
       records_fetched = COALESCE($3, records_fetched),
       records_created = COALESCE($4, records_created),
       records_updated = COALESCE($5, records_updated),
       records_deleted = COALESCE($6, records_deleted),
       duplicates_found = COALESCE($7, duplicates_found),
       completed_at = NOW(),
       duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
       error_message = $8,
       error_details = $9
     WHERE id = $1`,
    [
      id,
      status,
      metrics.records_fetched ?? null,
      metrics.records_created ?? null,
      metrics.records_updated ?? null,
      metrics.records_deleted ?? null,
      metrics.duplicates_found ?? null,
      errorMessage ?? null,
      errorDetails ? JSON.stringify(errorDetails) : null,
    ],
  );
}

/**
 * Get total POI count by source.
 */
export async function getPoiCountsBySource(): Promise<Record<string, number>> {
  const result = await query(
    `SELECT source, COUNT(*) AS count FROM pois WHERE is_canonical = TRUE GROUP BY source`,
  );
  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    counts[row.source] = parseInt(row.count, 10);
  }
  return counts;
}

/**
 * Clear all cached insights from PostgreSQL.
 * Call after ETL ingestion to prevent stale cached scores.
 */
export async function clearInsightsCache(): Promise<void> {
  await query(`TRUNCATE TABLE insights_cache`);
}
