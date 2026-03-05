/**
 * Facilities-focused API routes
 * Real-estate optimized insights
 */

import type { FastifyInstance } from 'fastify';
import { getFacilitiesInsights } from '../services/facilities-insights.js';
import { ERROR_CODES } from '@bogota-insights/shared';
import { isWithinBogota } from '../middleware/validation.js';

export async function facilitiesRoutes(fastify: FastifyInstance): Promise<void> {
  
  // GET /v1/facilities - Get facilities-focused insights
  fastify.get('/v1/facilities', async (request, reply) => {
    const { lat, lng, radius = '1000', lang = 'es' } = request.query as {
      lat?: string;
      lng?: string;
      radius?: string;
      lang?: string;
    };

    // Validate coordinates
    const latNum = parseFloat(lat || '');
    const lngNum = parseFloat(lng || '');

    if (isNaN(latNum) || isNaN(lngNum)) {
      return reply.code(400).send({
        error: {
          code: ERROR_CODES.INVALID_COORDINATES,
          message: 'lat and lng are required numeric parameters',
        },
      });
    }

    if (!isWithinBogota(latNum, lngNum)) {
      return reply.code(400).send({
        error: {
          code: ERROR_CODES.OUTSIDE_COVERAGE,
          message: 'Coordinates are outside the Bogota metropolitan area',
          details: {
            coverage_bounds: { north: 4.84, south: 4.45, east: -73.88, west: -74.27 },
          },
        },
      });
    }

    const radiusM = parseInt(radius, 10);

    try {
      const insights = await getFacilitiesInsights(latNum, lngNum, radiusM, lang);
      
      return reply.send({
        location: { lat: latNum, lng: lngNum },
        ...insights,
        meta: {
          radius_m: radiusM,
          lang,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      fastify.log.error(err, 'Error computing facilities insights');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to compute facilities insights',
        },
      });
    }
  });
}
