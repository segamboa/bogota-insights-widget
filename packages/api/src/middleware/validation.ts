import { z } from 'zod';
import { BOGOTA_BOUNDS, ERROR_CODES } from '@bogota-insights/shared';
import type { FastifyRequest, FastifyReply } from 'fastify';

export const insightsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(5000).default(1000),
  lang: z.enum(['es', 'en']).default('es'),
});

export const poisQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(5000).default(500),
  categories: z.string().optional(),
});

export type InsightsQuery = z.infer<typeof insightsQuerySchema>;
export type PoisQuery = z.infer<typeof poisQuerySchema>;

/**
 * Validate that coordinates fall within Bogota metro bounds.
 */
export function isWithinBogota(lat: number, lng: number): boolean {
  return (
    lat >= BOGOTA_BOUNDS.south &&
    lat <= BOGOTA_BOUNDS.north &&
    lng >= BOGOTA_BOUNDS.west &&
    lng <= BOGOTA_BOUNDS.east
  );
}

/**
 * Fastify preHandler hook for coordinate validation.
 */
export async function validateCoordinates(
  request: FastifyRequest<{ Querystring: { lat?: string; lng?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const lat = parseFloat(request.query.lat as string);
  const lng = parseFloat(request.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    reply.code(400).send({
      error: {
        code: ERROR_CODES.INVALID_COORDINATES,
        message: 'lat and lng are required numeric parameters',
      },
    });
    return;
  }

  if (!isWithinBogota(lat, lng)) {
    reply.code(400).send({
      error: {
        code: ERROR_CODES.OUTSIDE_COVERAGE,
        message: 'Coordinates are outside the Bogota metropolitan area',
        details: { coverage_bounds: BOGOTA_BOUNDS },
      },
    });
    return;
  }
}
