/**
 * Property ingestion runner.
 * Run with: npx tsx src/services/property-ingest-runner.ts [--metrocuadrado] [--all]
 */
import { config } from 'dotenv';
config();

import { pool } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { ingestMetrocuadrado } from './scrapers/metrocuadrado.js';
import { getPropertyCountsBySource } from '../db/property-queries.js';

interface IngestOptions {
  metrocuadrado?: {
    businessType?: string;
    propertyTypes?: string[];
    maxResults?: number;
  };
}

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes('--all') || args.length === 0;
  const runMetrocuadrado = runAll || args.includes('--metrocuadrado');

  // Parse options from args
  const options: IngestOptions = {};
  
  if (runMetrocuadrado) {
    options.metrocuadrado = {};
    
    // Parse --max-results flag
    const maxResultsIdx = args.findIndex(a => a.startsWith('--max-results='));
    if (maxResultsIdx >= 0) {
      const val = parseInt(args[maxResultsIdx].split('=')[1], 10);
      if (!isNaN(val)) {
        options.metrocuadrado.maxResults = val;
      }
    }
    
    // Parse --business-type flag
    const businessIdx = args.findIndex(a => a.startsWith('--business-type='));
    if (businessIdx >= 0) {
      options.metrocuadrado.businessType = args[businessIdx].split('=')[1];
    }
  }

  console.log('=== Bogota Insights Property Ingestion ===\n');

  // Run migrations first
  console.log('Running migrations...');
  await runMigrations();
  console.log('');

  if (runMetrocuadrado) {
    console.log('=== Metrocuadrado Properties ===');
    try {
      await ingestMetrocuadrado({
        businessType: options.metrocuadrado?.businessType || 'venta',
        propertyTypes: ['apartamento', 'casa', 'oficina'],
        maxResults: options.metrocuadrado?.maxResults || 1000,
      });
    } catch (err) {
      console.error('Metrocuadrado ingestion failed:', err);
    }
    console.log('');
  }

  // Print summary
  console.log('=== Properties Summary ===');
  try {
    const counts = await getPropertyCountsBySource();
    for (const [source, count] of Object.entries(counts)) {
      console.log(`  ${source}: ${count} properties`);
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`  TOTAL: ${total} properties`);
  } catch (err) {
    console.error('Could not fetch property summary:', err);
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
