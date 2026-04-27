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
  scores: Record<string, number>;
  total_pois: number;
}

interface SurveyData {
  results: SurveyPoint[];
}

const CATEGORIES: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];

// Lazy-loaded percentile tables
let percentileTables: Record<string, number[]> | null = null;

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
