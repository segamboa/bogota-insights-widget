#!/usr/bin/env tsx
/**
 * Monthly Score Snapshot
 *
 * Records current insight scores for all urban survey points
 * into the score_snapshots table for month-over-month trend analysis.
 *
 * Usage:
 *   export DATABASE_URL=postgresql://...
 *   npx tsx scripts/monthly-snapshot.ts
 */

import { config } from 'dotenv';
config();

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db/connection.js';
import { recordScoreSnapshot } from '../src/db/queries.js';
import { findPoisWithinRadius } from '../src/db/queries.js';
import { computeCategoryScore, computeOverallScore } from '../src/services/scoring.js';
import type { CategoryType } from '@bogota-insights/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATEGORIES: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];

interface SurveyPoint {
  lat: number;
  lng: number;
}

function loadSurveyPoints(): SurveyPoint[] {
  const path = join(__dirname, '../data/survey-urban-fine.json');
  const raw = readFileSync(path, 'utf-8');
  const data = JSON.parse(raw);
  return (data.results || [])
    .filter((r: any) => r.total_pois > 0)
    .map((r: any) => ({ lat: r.lat, lng: r.lng }));
}

async function snapshotPoint(lat: number, lng: number, radiusM: number): Promise<void> {
  const allPois = await findPoisWithinRadius(lng, lat, radiusM);

  const scores: Record<string, number> = {};
  const poisByCategory: Record<string, typeof allPois> = {};
  for (const poi of allPois) {
    if (!poisByCategory[poi.category]) poisByCategory[poi.category] = [];
    poisByCategory[poi.category].push(poi);
  }

  for (const category of CATEGORIES) {
    const result = computeCategoryScore(category, poisByCategory[category] || [], radiusM);
    scores[category] = result.score;
  }

  scores.overall = computeOverallScore(scores as Record<CategoryType, number>);

  await recordScoreSnapshot(lat, lng, radiusM, scores, 'v1');
}

async function main() {
  const points = loadSurveyPoints();
  const radiusM = 1000;

  console.log(`=== Monthly Score Snapshot ===`);
  console.log(`Points to snapshot: ${points.length}`);
  console.log(`Radius: ${radiusM}m\n`);

  let processed = 0;
  for (const { lat, lng } of points) {
    try {
      await snapshotPoint(lat, lng, radiusM);
      processed++;
      if (processed % 10 === 0 || processed === points.length) {
        process.stdout.write(`\r  Progress: ${processed}/${points.length}`);
      }
    } catch (err) {
      console.warn(`\n  ⚠️ Failed at ${lat},${lng}: ${(err as Error).message}`);
    }
  }

  console.log(`\n\n✅ Snapshots recorded: ${processed}/${points.length}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
