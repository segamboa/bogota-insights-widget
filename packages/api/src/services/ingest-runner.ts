/**
 * Data ingestion runner.
 * Run with: npx tsx src/services/ingest-runner.ts [--ideca] [--transmilenio] [--osm] [--all]
 */

import { config } from 'dotenv';
config();

import { pool } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { ingestAllIdecaDatasets } from './ideca-ingest.js';
import { ingestTransmilenioStops } from './transmilenio-ingest.js';
import { ingestAllOsmDatasets } from './osm-ingest.js';
import { getPoiCountsBySource } from '../db/queries.js';
import { flushInsightsCache } from '../cache/redis.js';

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes('--all') || args.length === 0;
  const runIdeca = runAll || args.includes('--ideca');
  const runTransmilenio = runAll || args.includes('--transmilenio');
  const runOsm = runAll || args.includes('--osm');

  console.log('=== Bogota Insights Data Ingestion ===\n');

  // Run migrations first
  console.log('Running migrations...');
  await runMigrations();
  console.log('');

  if (runIdeca) {
    console.log('=== IDECA Datasets ===');
    try {
      await ingestAllIdecaDatasets();
    } catch (err) {
      console.error('IDECA ingestion failed:', err);
    }
    console.log('');
  }

  if (runTransmilenio) {
    console.log('=== TransMilenio GTFS ===');
    try {
      await ingestTransmilenioStops();
    } catch (err) {
      console.error('TransMilenio ingestion failed:', err);
    }
    console.log('');
  }

  if (runOsm) {
    console.log('=== OpenStreetMap (Commerce + SITP) ===');
    try {
      await ingestAllOsmDatasets();
    } catch (err) {
      console.error('OSM ingestion failed:', err);
    }
    console.log('');
  }

  // Print summary
  console.log('=== POI Summary ===');
  try {
    const counts = await getPoiCountsBySource();
    for (const [source, count] of Object.entries(counts)) {
      console.log(`  ${source}: ${count} canonical POIs`);
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`  TOTAL: ${total} canonical POIs`);
  } catch (err) {
    console.error('Could not fetch POI summary:', err);
  }

  // Invalidate cached insights so new POIs are visible immediately
  try {
    const flushed = await flushInsightsCache();
    console.log(`\nFlushed ${flushed} cached insight entries from Redis`);
  } catch (err) {
    console.error('Could not flush insights cache:', err);
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
