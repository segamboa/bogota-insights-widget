import type { FastifyInstance } from 'fastify';
import { insightsQuerySchema } from '../middleware/validation.js';
import { isWithinBogota } from '../middleware/validation.js';
import { ERROR_CODES } from '@bogota-insights/shared';
import { getInsights } from '../services/insights.js';

export async function insightsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/v1/insights', async (request, reply) => {
    const parsed = insightsQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ERROR_CODES.INVALID_COORDINATES,
          message: 'Invalid query parameters',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { lat, lng, radius, lang } = parsed.data;

    if (!isWithinBogota(lat, lng)) {
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

    try {
      const result = await getInsights({ lat, lng, radiusM: radius, lang });
      const { _cacheHit, ...response } = result;
      response.meta.cache_hit = _cacheHit;
      return reply.send(response);
    } catch (err) {
      fastify.log.error(err, 'Error computing insights');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to compute insights',
        },
      });
    }
  });
}
