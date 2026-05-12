/**
 * Score percentile calculator.
 *
 * Loads survey distribution data and provides percentile lookups
 * so the API can answer "this score is better than X% of Bogotá".
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CategoryType } from '@bogota-insights/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SurveyPoint {
  lat: number;
  lng: number;
  scores: Record<string, number>;
  total_pois: number;
}

interface SurveyData {
  results: SurveyPoint[];
}

const CATEGORIES: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];

// Lazy-loaded percentile tables
let percentileTables: Record<string, number[]> | null = null;
let surveyPoints: Array<{ lat: number; lng: number; scores: Record<string, number> }> | null = null;

function loadSurveyData(): SurveyData | null {
  // Try multiple paths for flexibility (built vs source)
  const paths = [
    join(__dirname, '../../data/survey-urban-fine.json'),
    join(__dirname, '../../../data/survey-urban-fine.json'),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8');
        return JSON.parse(raw) as SurveyData;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function buildPercentileTables(data: SurveyData): Record<string, number[]> {
  const tables: Record<string, number[]> = {};
  const urbanPoints = data.results.filter((r) => r.total_pois > 0);

  for (const category of [...CATEGORIES, 'overall']) {
    const scores = urbanPoints
      .map((r) => r.scores[category] ?? 25)
      .sort((a, b) => a - b);
    tables[category] = scores;
  }

  return tables;
}

function loadSurveyPoints(): Array<{ lat: number; lng: number; scores: Record<string, number> }> {
  if (surveyPoints) return surveyPoints;

  const data = loadSurveyData();
  if (data) {
    surveyPoints = data.results
      .filter((r) => r.total_pois > 0)
      .map((r) => ({
        lat: r.lat ?? 0,
        lng: r.lng ?? 0,
        scores: r.scores,
      }));
  } else {
    surveyPoints = [];
  }

  return surveyPoints;
}

function ensureTables(): Record<string, number[]> {
  if (percentileTables) return percentileTables;

  const data = loadSurveyData();
  if (data) {
    percentileTables = buildPercentileTables(data);
  } else {
    // Fallback: uniform distribution (no survey data available)
    percentileTables = {};
    for (const category of [...CATEGORIES, 'overall']) {
      percentileTables[category] = [25, 50, 75, 100];
    }
  }

  return percentileTables;
}

/**
 * Compute the percentile of a given score within the Bogotá urban distribution.
 * Returns a value 0-100 representing "better than X% of locations".
 */
export function getPercentile(category: CategoryType | 'overall', score: number): number {
  const tables = ensureTables();
  const sorted = tables[category];
  if (!sorted || sorted.length === 0) return 50;

  // Find the first index where score < sorted[i]
  let idx = 0;
  while (idx < sorted.length && sorted[idx] <= score) {
    idx++;
  }

  return Math.round((idx / sorted.length) * 100);
}

/**
 * Get the score at a given percentile (e.g., p50 = median).
 * Useful for showing "city average is X".
 */
export function getScoreAtPercentile(category: CategoryType | 'overall', percentile: number): number {
  const tables = ensureTables();
  const sorted = tables[category];
  if (!sorted || sorted.length === 0) return 50;

  const idx = Math.min(Math.floor((percentile / 100) * sorted.length), sorted.length - 1);
  return sorted[idx];
}

/**
 * Get percentile context for all categories at once.
 */
export function getAllPercentiles(scores: Record<string, number>): Record<string, { percentile: number; cityMedian: number }> {
  const result: Record<string, { percentile: number; cityMedian: number }> = {};

  for (const category of [...CATEGORIES, 'overall']) {
    const score = scores[category] ?? 25;
    result[category] = {
      percentile: getPercentile(category as CategoryType | 'overall', score),
      cityMedian: getScoreAtPercentile(category as CategoryType | 'overall', 50),
    };
  }

  return result;
}

/** Haversine distance in km between two lat/lng points. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Compute local median and local percentile for a score.
 * Uses survey points within `radiusKm` of the target location.
 */
export function getLocalContext(
  lat: number,
  lng: number,
  category: CategoryType | 'overall',
  score: number,
  radiusKm: number = 3,
): { localMedian: number; localPercentile: number } {
  const points = loadSurveyPoints();
  const nearby = points.filter((p) => haversine(lat, lng, p.lat, p.lng) <= radiusKm);

  if (nearby.length === 0) {
    return { localMedian: 50, localPercentile: 50 };
  }

  const scores = nearby.map((p) => p.scores[category] ?? 25).sort((a, b) => a - b);
  const median = scores[Math.floor(scores.length / 2)];

  let idx = 0;
  while (idx < scores.length && scores[idx] <= score) {
    idx++;
  }
  const percentile = Math.round((idx / scores.length) * 100);

  return { localMedian: median, localPercentile: percentile };
}

/**
 * Get local context for all categories at once.
 */
export function getAllLocalContext(
  lat: number,
  lng: number,
  scores: Record<string, number>,
  radiusKm: number = 3,
): Record<string, { localMedian: number; localPercentile: number }> {
  const result: Record<string, { localMedian: number; localPercentile: number }> = {};

  for (const category of [...CATEGORIES, 'overall']) {
    const score = scores[category] ?? 25;
    result[category] = getLocalContext(lat, lng, category as CategoryType | 'overall', score, radiusKm);
  }

  return result;
}
