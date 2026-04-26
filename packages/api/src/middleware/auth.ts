import { createHash } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/connection.js';
import { ERROR_CODES } from '@bogota-insights/shared';
import { TIER_LIMITS } from '../config.js';

export interface AuthenticatedRequest {
  apiKeyId?: string;
  customerId?: string;
  customerTier?: string;
  rateLimits?: {
    perMinute: number;
    perDay: number;
  };
}

/**
 * Hash an API key for comparison with stored hashes.
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Fastify preHandler hook for API key authentication.
 * In development mode, authentication is optional.
 */
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string | undefined;

  // In development, allow unauthenticated requests
  if (process.env.NODE_ENV === 'development' && !apiKey) {
    (request as any).auth = {
      apiKeyId: 'dev',
      customerId: 'dev',
      customerTier: 'enterprise',
      rateLimits: TIER_LIMITS.enterprise,
    } satisfies AuthenticatedRequest;
    return;
  }

  if (!apiKey) {
    reply.code(401).send({
      error: {
        code: ERROR_CODES.INVALID_API_KEY,
        message: 'X-API-Key header is required',
      },
    });
    return;
  }

  const keyHash = hashApiKey(apiKey);

  try {
    const result = await query(
      `SELECT ak.id AS key_id, ak.customer_id, ak.rate_limit_per_minute, ak.rate_limit_per_day,
              c.tier, c.is_active AS customer_active
       FROM api_keys ak
       JOIN customers c ON c.id = ak.customer_id
       WHERE ak.key_hash = $1 AND ak.is_active = TRUE
         AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
      [keyHash],
    );

    if (result.rows.length === 0) {
      reply.code(401).send({
        error: {
          code: ERROR_CODES.INVALID_API_KEY,
          message: 'Invalid or expired API key',
        },
      });
      return;
    }

    const row = result.rows[0];
    if (!row.customer_active) {
      reply.code(403).send({
        error: {
          code: ERROR_CODES.INVALID_API_KEY,
          message: 'Account is inactive',
        },
      });
      return;
    }

    const tierLimits = TIER_LIMITS[row.tier] || TIER_LIMITS.free;

    (request as any).auth = {
      apiKeyId: row.key_id,
      customerId: row.customer_id,
      customerTier: row.tier,
      rateLimits: {
        perMinute: row.rate_limit_per_minute ?? tierLimits.perMinute,
        perDay: row.rate_limit_per_day ?? tierLimits.perDay,
      },
    } satisfies AuthenticatedRequest;

    // Update last_used_at (fire-and-forget)
    query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.key_id]).catch(() => {});
  } catch (err) {
    console.error('Auth error:', err);
    // In case of DB failure, allow request in development
    if (process.env.NODE_ENV === 'development') {
      (request as any).auth = {
        apiKeyId: 'dev',
        customerId: 'dev',
        customerTier: 'enterprise',
        rateLimits: TIER_LIMITS.enterprise,
      } satisfies AuthenticatedRequest;
      return;
    }
    reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Authentication service unavailable' } });
  }
}
