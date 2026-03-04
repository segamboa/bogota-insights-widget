/**
 * Heatmap API routes for calibration analysis
 */

import type { FastifyInstance } from 'fastify';
import { pool } from '../db/connection.js';
import { getHeatmapStats } from '../services/heatmap-compute.js';
import { BOGOTA_BOUNDS } from '@bogota-insights/shared';

export async function heatmapRoutes(fastify: FastifyInstance): Promise<void> {
  
  // GET /admin/heatmap - Get heatmap data for bounds
  fastify.get('/admin/heatmap', async (request, reply) => {
    const { 
      north, 
      south, 
      east, 
      west, 
      category = 'overall',
      minScore,
      maxScore,
      limit = '1000'
    } = request.query as {
      north?: string;
      south?: string;
      east?: string;
      west?: string;
      category?: string;
      minScore?: string;
      maxScore?: string;
      limit?: string;
    };

    // Validate bounds
    if (!north || !south || !east || !west) {
      return reply.code(400).send({
        error: {
          code: 'MISSING_BOUNDS',
          message: 'Required: north, south, east, west parameters'
        }
      });
    }

    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west),
    };

    // Validate category
    const validCategories = ['overall', 'transport', 'commerce', 'education', 'health', 'recreation'];
    if (!validCategories.includes(category)) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_CATEGORY',
          message: `Valid categories: ${validCategories.join(', ')}`
        }
      });
    }

    try {
      const scoreColumn = category === 'overall' 
        ? 'score_overall' 
        : `score_${category}`;

      let query = `
        SELECT 
          geohash_6,
          lat_center,
          lng_center,
          ${scoreColumn} as score,
          poi_count,
          computed_at
        FROM heatmap_cells
        WHERE lat_center BETWEEN $1 AND $2
          AND lng_center BETWEEN $3 AND $4
      `;

      const params: (number | string)[] = [bounds.south, bounds.north, bounds.west, bounds.east];

      // Add score filters
      if (minScore !== undefined) {
        query += ` AND ${scoreColumn} >= $${params.length + 1}`;
        params.push(parseInt(minScore, 10));
      }
      if (maxScore !== undefined) {
        query += ` AND ${scoreColumn} <= $${params.length + 1}`;
        params.push(parseInt(maxScore, 10));
      }

      // Add limit
      query += ` ORDER BY ${scoreColumn} DESC LIMIT $${params.length + 1}`;
      params.push(parseInt(limit, 10));

      const result = await pool.query(query, params);

      return reply.send({
        type: 'FeatureCollection',
        bounds,
        category,
        total: result.rows.length,
        features: result.rows.map(row => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(row.lng_center), parseFloat(row.lat_center)]
          },
          properties: {
            geohash: row.geohash_6,
            score: parseInt(row.score, 10),
            poiCount: parseInt(row.poi_count, 10),
            computedAt: row.computed_at,
          }
        })),
        meta: {
          query: {
            bounds,
            category,
            minScore: minScore ? parseInt(minScore, 10) : undefined,
            maxScore: maxScore ? parseInt(maxScore, 10) : undefined,
            limit: parseInt(limit, 10),
          },
          timestamp: new Date().toISOString(),
        }
      });

    } catch (err) {
      fastify.log.error(err, 'Error fetching heatmap data');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch heatmap data'
        }
      });
    }
  });

  // GET /admin/heatmap/stats - Get heatmap statistics
  fastify.get('/admin/heatmap/stats', async (request, reply) => {
    try {
      const stats = await getHeatmapStats();
      return reply.send(stats);
    } catch (err) {
      fastify.log.error(err, 'Error fetching heatmap stats');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch heatmap statistics'
        }
      });
    }
  });

  // GET /admin/heatmap/distribution - Get score distribution
  fastify.get('/admin/heatmap/distribution', async (request, reply) => {
    const { category = 'overall', buckets = '10' } = request.query as {
      category?: string;
      buckets?: string;
    };

    const scoreColumn = category === 'overall' 
      ? 'score_overall' 
      : `score_${category}`;

    const numBuckets = parseInt(buckets, 10);
    const bucketSize = 100 / numBuckets;

    try {
      const query = `
        SELECT 
          width_bucket(${scoreColumn}, 0, 100, ${numBuckets}) as bucket,
          COUNT(*) as count,
          MIN(${scoreColumn}) as min_score,
          MAX(${scoreColumn}) as max_score
        FROM heatmap_cells
        WHERE ${scoreColumn} IS NOT NULL
        GROUP BY width_bucket(${scoreColumn}, 0, 100, ${numBuckets})
        ORDER BY bucket
      `;

      const result = await pool.query(query);

      return reply.send({
        category,
        buckets: numBuckets,
        distribution: result.rows.map(row => ({
          bucket: parseInt(row.bucket, 10),
          range: {
            min: parseInt(row.min_score, 10),
            max: parseInt(row.max_score, 10),
          },
          count: parseInt(row.count, 10),
          percentage: 0, // Will be calculated below
        })).map(b => ({
          ...b,
          percentage: Math.round((b.count / result.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0)) * 100 * 100) / 100,
        })),
        total: result.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0),
      });

    } catch (err) {
      fastify.log.error(err, 'Error fetching distribution');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch score distribution'
        }
      });
    }
  });

  // GET /admin/heatmap/coverage - Check computed coverage
  fastify.get('/admin/heatmap/coverage', async (request, reply) => {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_cells,
          COUNT(CASE WHEN computed_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_cells,
          MIN(computed_at) as oldest_computation,
          MAX(computed_at) as newest_computation
        FROM heatmap_cells
      `);

      const bounds = await pool.query(`
        SELECT 
          MIN(lat_center) as min_lat,
          MAX(lat_center) as max_lat,
          MIN(lng_center) as min_lng,
          MAX(lng_center) as max_lng
        FROM heatmap_cells
      `);

      return reply.send({
        coverage: {
          totalCells: parseInt(result.rows[0].total_cells, 10),
          recentCells: parseInt(result.rows[0].recent_cells, 10),
          oldestComputation: result.rows[0].oldest_computation,
          newestComputation: result.rows[0].newest_computation,
        },
        bounds: {
          minLat: parseFloat(bounds.rows[0].min_lat),
          maxLat: parseFloat(bounds.rows[0].max_lat),
          minLng: parseFloat(bounds.rows[0].min_lng),
          maxLng: parseFloat(bounds.rows[0].max_lng),
        },
        bogotaBounds: BOGOTA_BOUNDS,
      });

    } catch (err) {
      fastify.log.error(err, 'Error fetching coverage');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch coverage data'
        }
      });
    }
  });
}
