import type { FastifyInstance } from 'fastify';
import { insightsQuerySchema, isWithinBogota } from '../middleware/validation.js';
import { ERROR_CODES } from '@bogota-insights/shared';
import { getInsights } from '../services/insights.js';

export async function scoresRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/v1/scores', async (request, reply) => {
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
        },
      });
    }

    try {
      const result = await getInsights({ lat, lng, radiusM: radius, lang });
      return reply.send({
        scores: result.scores,
        meta: {
          data_timestamp: result.meta.data_timestamp,
          radius_m: result.meta.radius_m,
          cache_hit: result._cacheHit,
        },
      });
    } catch (err) {
      fastify.log.error(err, 'Error computing scores');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to compute scores',
        },
      });
    }
  });
}
