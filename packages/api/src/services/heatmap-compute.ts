/**
 * Heatmap computation job
 * Batch processes grid cells to compute scores for calibration analysis
 */

import { generateBogotaGrid, generateCustomGrid, GridCell } from './grid-generator.js';
import { getInsights } from './insights.js';
import { pool } from '../db/connection.js';
import { BOGOTA_BOUNDS } from '@bogota-insights/shared';

interface ComputationProgress {
  total: number;
  processed: number;
  errors: number;
  startTime: Date;
  estimatedEnd?: Date;
}

/**
 * Compute scores for a single grid cell
 */
async function computeCellScore(
  cell: GridCell,
  radiusM: number = 1000
): Promise<{
  geohash: string;
  lat: number;
  lng: number;
  scores: {
    overall: number;
    transport: number;
    commerce: number;
    education: number;
    health: number;
    recreation: number;
  };
  poiCount: number;
} | null> {
  try {
    const result = await getInsights({
      lat: cell.lat,
      lng: cell.lng,
      radiusM,
      lang: 'es',
    });

    return {
      geohash: cell.geohash,
      lat: cell.lat,
      lng: cell.lng,
      scores: result.scores,
      poiCount: Object.values(result.categories).reduce(
        (sum, cat) => sum + cat.pois.length,
        0
      ),
    };
  } catch (err) {
    console.error(`Error computing cell ${cell.geohash}:`, err);
    return null;
  }
}

/**
 * Save computed cell to database
 */
async function saveHeatmapCell(
  cell: NonNullable<Awaited<ReturnType<typeof computeCellScore>>>,
  radiusM: number
): Promise<void> {
  await pool.query(
    `
    INSERT INTO heatmap_cells (
      geohash_6, lat_center, lng_center,
      score_overall, score_transport, score_commerce,
      score_education, score_health, score_recreation,
      poi_count, radius_m, geom
    ) VALUES ($1, $2::float8, $3::float8, $4, $5, $6, $7, $8, $9, $10, $11, ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326))
    ON CONFLICT (geohash_6) DO UPDATE SET
      score_overall = EXCLUDED.score_overall,
      score_transport = EXCLUDED.score_transport,
      score_commerce = EXCLUDED.score_commerce,
      score_education = EXCLUDED.score_education,
      score_health = EXCLUDED.score_health,
      score_recreation = EXCLUDED.score_recreation,
      poi_count = EXCLUDED.poi_count,
      radius_m = EXCLUDED.radius_m,
      computed_at = NOW()
    `,
    [
      cell.geohash,
      cell.lat,
      cell.lng,
      cell.scores.overall,
      cell.scores.transport,
      cell.scores.commerce,
      cell.scores.education,
      cell.scores.health,
      cell.scores.recreation,
      cell.poiCount,
      radiusM,
    ]
  );
}

/**
 * Main batch computation function
 */
export async function computeHeatmapBatch(
  options: {
    spacingMeters?: number;
    radiusMeters?: number;
    bounds?: typeof BOGOTA_BOUNDS;
    batchSize?: number;
    onProgress?: (progress: ComputationProgress) => void;
  } = {}
): Promise<{ processed: number; errors: number; duration: number }> {
  const {
    spacingMeters = 1000,
    radiusMeters = 1000,
    bounds = BOGOTA_BOUNDS,
    batchSize = 100,
  } = options;

  console.log('Starting heatmap batch computation...');
  console.log(`Spacing: ${spacingMeters}m, Radius: ${radiusMeters}m`);

  const startTime = new Date();
  
  // Generate grid
  const grid = bounds === BOGOTA_BOUNDS
    ? generateBogotaGrid(spacingMeters)
    : generateCustomGrid(bounds, spacingMeters);

  console.log(`Generated ${grid.length} grid cells`);

  let processed = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < grid.length; i += batchSize) {
    const batch = grid.slice(i, i + batchSize);
    
    // Process batch concurrently
    const results = await Promise.all(
      batch.map(cell => computeCellScore(cell, radiusMeters))
    );

    // Save results
    for (const result of results) {
      if (result) {
        try {
          await saveHeatmapCell(result, radiusMeters);
          processed++;
        } catch (err) {
          console.error(`Error saving cell ${result.geohash}:`, err);
          errors++;
        }
      } else {
        errors++;
      }
    }

    // Report progress
    if (options.onProgress) {
      const elapsed = Date.now() - startTime.getTime();
      const rate = processed / (elapsed / 1000);
      const remaining = (grid.length - processed) / rate;
      
      options.onProgress({
        total: grid.length,
        processed,
        errors,
        startTime,
        estimatedEnd: new Date(Date.now() + remaining * 1000),
      });
    }

    // Progress log every 10%
    if (processed % Math.ceil(grid.length / 10) === 0) {
      const percent = Math.round((processed / grid.length) * 100);
      console.log(`Progress: ${percent}% (${processed}/${grid.length})`);
    }

    // Small delay to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const duration = Date.now() - startTime.getTime();
  console.log(`\nComputation complete!`);
  console.log(`Processed: ${processed}, Errors: ${errors}`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(`Rate: ${(processed / (duration / 1000)).toFixed(1)} cells/sec`);

  return { processed, errors, duration };
}

/**
 * Get statistics from computed heatmap
 */
export async function getHeatmapStats(): Promise<{
  totalCells: number;
  avgOverall: number;
  minOverall: number;
  maxOverall: number;
  byCategory: Record<string, { avg: number; min: number; max: number }>;
}> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      AVG(score_overall) as avg_overall,
      MIN(score_overall) as min_overall,
      MAX(score_overall) as max_overall,
      AVG(score_transport) as avg_transport,
      MIN(score_transport) as min_transport,
      MAX(score_transport) as max_transport,
      AVG(score_commerce) as avg_commerce,
      MIN(score_commerce) as min_commerce,
      MAX(score_commerce) as max_commerce,
      AVG(score_education) as avg_education,
      MIN(score_education) as min_education,
      MAX(score_education) as max_education,
      AVG(score_health) as avg_health,
      MIN(score_health) as min_health,
      MAX(score_health) as max_health,
      AVG(score_recreation) as avg_recreation,
      MIN(score_recreation) as min_recreation,
      MAX(score_recreation) as max_recreation
    FROM heatmap_cells
    WHERE computed_at > NOW() - INTERVAL '7 days'
  `);

  const row = result.rows[0];
  
  return {
    totalCells: parseInt(row.total, 10),
    avgOverall: Math.round(parseFloat(row.avg_overall)),
    minOverall: parseInt(row.min_overall, 10),
    maxOverall: parseInt(row.max_overall, 10),
    byCategory: {
      transport: {
        avg: Math.round(parseFloat(row.avg_transport)),
        min: parseInt(row.min_transport, 10),
        max: parseInt(row.max_transport, 10),
      },
      commerce: {
        avg: Math.round(parseFloat(row.avg_commerce)),
        min: parseInt(row.min_commerce, 10),
        max: parseInt(row.max_commerce, 10),
      },
      education: {
        avg: Math.round(parseFloat(row.avg_education)),
        min: parseInt(row.min_education, 10),
        max: parseInt(row.max_education, 10),
      },
      health: {
        avg: Math.round(parseFloat(row.avg_health)),
        min: parseInt(row.min_health, 10),
        max: parseInt(row.max_health, 10),
      },
      recreation: {
        avg: Math.round(parseFloat(row.avg_recreation)),
        min: parseInt(row.min_recreation, 10),
        max: parseInt(row.max_recreation, 10),
      },
    },
  };
}

// CLI runner
if (process.argv[1] && process.argv[1].includes('heatmap-compute')) {
  const spacing = parseInt(process.argv[2] || '1000', 10);
  const radius = parseInt(process.argv[3] || '1000', 10);

  computeHeatmapBatch({ spacingMeters: spacing, radiusMeters: radius })
    .then(stats => {
      console.log('\nFinal stats:', stats);
      process.exit(0);
    })
    .catch(err => {
      console.error('Computation failed:', err);
      process.exit(1);
    });
}
