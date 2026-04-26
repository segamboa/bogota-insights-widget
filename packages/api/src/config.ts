/**
 * Centralized configuration for the API.
 * All environment-sensitive values with sensible defaults.
 */

import { BOGOTA_BOUNDS } from '@bogota-insights/shared';

function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

function envFloat(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseFloat(val) : defaultValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// ETL Verification Thresholds (SPEC-005)
// ─────────────────────────────────────────────────────────────────────────────

export const ETL_THRESHOLDS = {
  total_pois: {
    min: envInt('ETL_TOTAL_POIS_MIN', 20_000),
    optimal: envInt('ETL_TOTAL_POIS_OPTIMAL', 27_000),
    critical: envInt('ETL_TOTAL_POIS_CRITICAL', 15_000),
  },
  ideca: {
    min: envInt('ETL_IDECA_MIN', 4_000),
    optimal: envInt('ETL_IDECA_OPTIMAL', 6_000),
    critical: envInt('ETL_IDECA_CRITICAL', 3_000),
  },
  osm: {
    min: envInt('ETL_OSM_MIN', 12_000),
    optimal: envInt('ETL_OSM_OPTIMAL', 18_000),
    critical: envInt('ETL_OSM_CRITICAL', 10_000),
  },
  transmilenio: {
    min: envInt('ETL_TRANSMILENIO_MIN', 100),
    optimal: envInt('ETL_TRANSMILENIO_OPTIMAL', 150),
    critical: envInt('ETL_TRANSMILENIO_CRITICAL', 50),
  },
};

export const ETL_CATEGORY_RANGES: Record<string, { min: number; max: number }> = {
  education: { min: envInt('ETL_CAT_EDUCATION_MIN', 3_000), max: envInt('ETL_CAT_EDUCATION_MAX', 5_000) },
  health: { min: envInt('ETL_CAT_HEALTH_MIN', 2_000), max: envInt('ETL_CAT_HEALTH_MAX', 3_000) },
  commerce: { min: envInt('ETL_CAT_COMMERCE_MIN', 10_000), max: envInt('ETL_CAT_COMMERCE_MAX', 15_000) },
  transport: { min: envInt('ETL_CAT_TRANSPORT_MIN', 5_000), max: envInt('ETL_CAT_TRANSPORT_MAX', 7_000) },
  recreation: { min: envInt('ETL_CAT_RECREATION_MIN', 3_000), max: envInt('ETL_CAT_RECREATION_MAX', 5_000) },
};

export const ETL_SUBCATEGORY_MIN: Record<string, number> = {
  transport: envInt('ETL_SUB_TRANSPORT_MIN', 3),
  commerce: envInt('ETL_SUB_COMMERCE_MIN', 6),
  education: envInt('ETL_SUB_EDUCATION_MIN', 4),
  health: envInt('ETL_SUB_HEALTH_MIN', 4),
  recreation: envInt('ETL_SUB_RECREATION_MIN', 3),
};

export const ETL_DATA_FRESHNESS_DAYS = envInt('ETL_DATA_FRESHNESS_DAYS', 30);

// ─────────────────────────────────────────────────────────────────────────────
// Geographic Bounds (override via env for future multi-city support)
// ─────────────────────────────────────────────────────────────────────────────

export const GEO_BOUNDS = {
  north: envFloat('GEO_BOUNDS_NORTH', BOGOTA_BOUNDS.north),
  south: envFloat('GEO_BOUNDS_SOUTH', BOGOTA_BOUNDS.south),
  east: envFloat('GEO_BOUNDS_EAST', BOGOTA_BOUNDS.east),
  west: envFloat('GEO_BOUNDS_WEST', BOGOTA_BOUNDS.west),
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth & Rate Limiting
// ─────────────────────────────────────────────────────────────────────────────

export const TIER_LIMITS: Record<string, { perMinute: number; perDay: number }> = {
  free: {
    perMinute: envInt('TIER_FREE_PER_MINUTE', 10),
    perDay: envInt('TIER_FREE_PER_DAY', 500),
  },
  standard: {
    perMinute: envInt('TIER_STANDARD_PER_MINUTE', 60),
    perDay: envInt('TIER_STANDARD_PER_DAY', 10_000),
  },
  enterprise: {
    perMinute: envInt('TIER_ENTERPRISE_PER_MINUTE', 300),
    perDay: envInt('TIER_ENTERPRISE_PER_DAY', 100_000),
  },
};
