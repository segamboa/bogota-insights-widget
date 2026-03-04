import type { FastifyInstance } from 'fastify';
import { poisQuerySchema, isWithinBogota } from '../middleware/validation.js';
import { ERROR_CODES } from '@bogota-insights/shared';
import type { CategoryType } from '@bogota-insights/shared';
import { findPoisWithinRadius, findPoisByCategory } from '../db/queries.js';

export async function poisRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/v1/pois', async (request, reply) => {
    const parsed = poisQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ERROR_CODES.INVALID_COORDINATES,
          message: 'Invalid query parameters',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { lat, lng, radius, categories } = parsed.data;

    if (!isWithinBogota(lat, lng)) {
      return reply.code(400).send({
        error: {
          code: ERROR_CODES.OUTSIDE_COVERAGE,
          message: 'Coordinates are outside the Bogota metropolitan area',
        },
      });
    }

    try {
      let pois;
      if (categories) {
        const categoryList = categories.split(',') as CategoryType[];
        const results = await Promise.all(
          categoryList.map((cat) => findPoisByCategory(lng, lat, radius, cat)),
        );
        pois = results.flat();
      } else {
        pois = await findPoisWithinRadius(lng, lat, radius);
      }

      const formatted = pois.map((p) => ({
        id: String(p.id),
        name: p.name || p.name_es || null,
        type: p.subcategory,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        distance_m: Math.round(p.distance_m),
        source: p.source,
        address: p.address,
      }));

      return reply.send({
        pois: formatted,
        total: formatted.length,
        meta: {
          lat,
          lng,
          radius_m: radius,
          categories: categories ? categories.split(',') : null,
        },
      });
    } catch (err) {
      fastify.log.error(err, 'Error fetching POIs');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch POIs',
        },
      });
    }
  });
}
