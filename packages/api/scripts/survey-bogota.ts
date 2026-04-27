#!/usr/bin/env tsx
/**
 * Bogotá Insights Score Survey
 *
 * Generates a grid of test points across Bogotá and computes insight scores
 * for each location. Outputs a JSON file with raw results plus summary
 * statistics to help identify scoring distribution, outliers, and data gaps.
 *
 * Usage:
 *   export DATABASE_URL=postgresql://...
 *   npx tsx scripts/survey-bogota.ts [--step 0.03] [--radius 1000] [--output survey.json]
 */

import { config } from 'dotenv';
config();

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from '../src/db/connection.js';
import { findPoisWithinRadius } from '../src/db/queries.js';
import { computeCategoryScore, computeOverallScore } from '../src/services/scoring.js';
import type { CategoryType } from '@bogota-insights/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATEGORIES: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];

// Bogotá bounding box (from shared package, slightly tightened)
const BOUNDS = {
  south: 4.47,
  north: 4.82,
  west: -74.25,
  east: -73.92,
};

interface BoundaryPolygon {
  geometry: string;
}

interface SurveyResult {
  lat: number;
  lng: number;
  radius_m: number;
  total_pois: number;
  scores: Record<string, number>;
  category_counts: Record<string, number>;
  sources: string[];
}

interface SurveySummary {
  total_points: number;
  points_with_pois: number;
  points_empty: number;
  overall: { min: number; max: number; mean: number; median: number; p25: number; p75: number };
  by_category: Record<string, { min: number; max: number; mean: number; median: number }>;
  top_locations: Array<{ lat: number; lng: number; overall: number; total_pois: number }>;
  bottom_locations: Array<{ lat: number; lng: number; overall: number; total_pois: number }>;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let step = 0.03;
  let radiusM = 1000;
  let output = 'survey-bogota.json';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--step' && args[i + 1]) step = parseFloat(args[i + 1]);
    if (args[i] === '--radius' && args[i + 1]) radiusM = parseInt(args[i + 1], 10);
    if (args[i] === '--output' && args[i + 1]) output = args[i + 1];
  }

  return { step, radiusM, output };
}

function generateGrid(step: number): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  for (let lat = BOUNDS.south; lat <= BOUNDS.north; lat += step) {
    for (let lng = BOUNDS.west; lng <= BOUNDS.east; lng += step * 1.5) {
      // longitude step adjusted for latitude (approximate)
      points.push({ lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)) });
    }
  }
  return points;
}

async function filterPointsByPoiDensity(
  points: Array<{ lat: number; lng: number }>,
  minPois: number = 10,
  radiusM: number = 2000,
): Promise<Array<{ lat: number; lng: number }>> {
  // A point is considered "urban" if it has at least minPois canonical POIs
  // within radiusM. This excludes rural edges, mountains, and reservoirs.
  const result = await query(`
    SELECT count
    FROM UNNEST($1::float[], $2::float[]) AS t(lng, lat)
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as count
      FROM pois
      WHERE is_canonical = TRUE
        AND ST_DWithin(location, ST_MakePoint(t.lng, t.lat)::geography, $3)
    ) poi_count ON true
  `, [points.map((p) => p.lng), points.map((p) => p.lat), radiusM]);

  return points.filter((_, i) => (result.rows[i]?.count ?? 0) >= minPois);
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

async function computeForPoint(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<SurveyResult | null> {
  try {
    const allPois = await findPoisWithinRadius(lng, lat, radiusM);
    if (allPois.length === 0) {
      return {
        lat,
        lng,
        radius_m: radiusM,
        total_pois: 0,
        scores: Object.fromEntries(CATEGORIES.map((c) => [c, 25]).concat([['overall', 25]])),
        category_counts: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
        sources: [],
      };
    }

    const poisByCategory: Record<string, typeof allPois> = {};
    for (const poi of allPois) {
      if (!poisByCategory[poi.category]) poisByCategory[poi.category] = [];
      poisByCategory[poi.category].push(poi);
    }

    const scores: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    for (const category of CATEGORIES) {
      const categoryPois = poisByCategory[category] || [];
      const result = computeCategoryScore(category, categoryPois, radiusM);
      scores[category] = result.score;
      categoryCounts[category] = categoryPois.length;
    }

    scores.overall = computeOverallScore(scores as Record<CategoryType, number>);

    const sources = [...new Set(allPois.map((p) => p.source))];

    return {
      lat,
      lng,
      radius_m: radiusM,
      total_pois: allPois.length,
      scores,
      category_counts: categoryCounts,
      sources,
    };
  } catch (err) {
    console.warn(`  ⚠️ Error at ${lat},${lng}: ${(err as Error).message}`);
    return null;
  }
}

function buildSummary(results: SurveyResult[]): SurveySummary {
  const valid = results.filter((r) => r.scores.overall !== undefined);
  const overalls = valid.map((r) => r.scores.overall).sort((a, b) => a - b);

  const byCategory: Record<string, number[]> = {};
  for (const cat of CATEGORIES) {
    byCategory[cat] = valid.map((r) => r.scores[cat]).sort((a, b) => a - b);
  }

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const withPois = valid.filter((r) => r.total_pois > 0);
  const sortedByScore = [...withPois].sort((a, b) => b.scores.overall - a.scores.overall);

  return {
    total_points: valid.length,
    points_with_pois: withPois.length,
    points_empty: valid.length - withPois.length,
    overall: {
      min: overalls[0],
      max: overalls[overalls.length - 1],
      mean: Math.round(mean(overalls)),
      median: percentile(overalls, 50),
      p25: percentile(overalls, 25),
      p75: percentile(overalls, 75),
    },
    by_category: Object.fromEntries(
      CATEGORIES.map((cat) => {
        const arr = byCategory[cat];
        return [
          cat,
          {
            min: arr[0],
            max: arr[arr.length - 1],
            mean: Math.round(mean(arr)),
            median: percentile(arr, 50),
          },
        ];
      }),
    ),
    top_locations: sortedByScore.slice(0, 5).map((r) => ({
      lat: r.lat,
      lng: r.lng,
      overall: r.scores.overall,
      total_pois: r.total_pois,
    })),
    bottom_locations: sortedByScore.slice(-5).reverse().map((r) => ({
      lat: r.lat,
      lng: r.lng,
      overall: r.scores.overall,
      total_pois: r.total_pois,
    })),
  };
}

async function main() {
  const { step, radiusM, output } = parseArgs();
  const points = generateGrid(step);

  console.log(`=== Bogotá Insights Survey ===`);
  console.log(`Grid step: ${step}° (~${Math.round(step * 111)} km lat)`);
  console.log(`Initial grid points: ${points.length}`);

  const filteredPoints = await filterPointsByPoiDensity(points, 10, 2000);
  console.log(`After urban density filter (≥10 POIs in 2km): ${filteredPoints.length}`);

  console.log(`Radius: ${radiusM}m\n`);

  const results: SurveyResult[] = [];
  let processed = 0;

  for (const { lat, lng } of filteredPoints) {
    const result = await computeForPoint(lat, lng, radiusM);
    if (result) results.push(result);
    processed++;
    if (processed % 10 === 0 || processed === filteredPoints.length) {
      process.stdout.write(`\r  Progress: ${processed}/${filteredPoints.length}`);
    }
  }
  console.log('\n');

  const summary = buildSummary(results);

  const outputPath = join(__dirname, '../data', output);
  writeFileSync(
    outputPath,
    JSON.stringify({ summary, results }, null, 2),
  );

  console.log('=== Summary ===');
  console.log(`Points surveyed: ${summary.total_points}`);
  console.log(`Points with POIs: ${summary.points_with_pois}`);
  console.log(`Empty points: ${summary.points_empty}`);
  console.log('');
  console.log(`Overall score distribution:`);
  console.log(`  Min: ${summary.overall.min} | P25: ${summary.overall.p25} | Median: ${summary.overall.median} | P75: ${summary.overall.p75} | Max: ${summary.overall.max}`);
  console.log(`  Mean: ${summary.overall.mean}`);
  console.log('');
  console.log('Category averages:');
  for (const [cat, stats] of Object.entries(summary.by_category)) {
    console.log(`  ${cat}: mean=${stats.mean} median=${stats.median} (range ${stats.min}-${stats.max})`);
  }
  console.log('');
  console.log('Top 5 locations:');
  for (const loc of summary.top_locations) {
    console.log(`  ${loc.lat}, ${loc.lng} → overall ${loc.overall} (${loc.total_pois} POIs)`);
  }
  console.log('');
  console.log('Bottom 5 locations:');
  for (const loc of summary.bottom_locations) {
    console.log(`  ${loc.lat}, ${loc.lng} → overall ${loc.overall} (${loc.total_pois} POIs)`);
  }
  console.log(`\n📁 Full results saved to: ${outputPath}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
