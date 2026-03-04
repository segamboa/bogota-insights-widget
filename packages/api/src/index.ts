/**
 * Fastify API Server for Bogota Insights Widget
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from 'dotenv';

import { healthCheck as dbHealthCheck, shutdown as dbShutdown } from './db/connection.js';
import { connectRedis, healthCheck as redisHealthCheck, shutdown as redisShutdown } from './cache/redis.js';
import { runMigrations } from './db/migrate.js';
import { authenticateApiKey } from './middleware/auth.js';
import { insightsRoutes } from './routes/insights.js';
import { scoresRoutes } from './routes/scores.js';
import { poisRoutes } from './routes/pois.js';

// Load environment variables
config();

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Security middleware
await fastify.register(helmet, {
  contentSecurityPolicy: false,
});

// CORS - permissive for embeddable widget
await fastify.register(cors, {
  origin: true,
  methods: ['GET'],
  maxAge: 86400,
});

// Rate limiting
await fastify.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
});

// Health check
fastify.get('/health', async () => {
  const db = await dbHealthCheck();
  const redis = await redisHealthCheck();
  return {
    status: db && redis ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: { database: db ? 'up' : 'down', redis: redis ? 'up' : 'down' },
  };
});

// API key auth hook for /v1/* routes
fastify.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/v1/')) {
    await authenticateApiKey(request, reply);
  }
});

// Register route handlers
await fastify.register(insightsRoutes);
await fastify.register(scoresRoutes);
await fastify.register(poisRoutes);

// Start server
const start = async () => {
  try {
    // Connect to Redis
    await connectRedis();

    // Run database migrations
    try {
      await runMigrations();
    } catch (err) {
      console.error('Migration warning:', err);
      console.log('Continuing without migrations (database may not be available)');
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`API server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  await fastify.close();
  await redisShutdown();
  await dbShutdown();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
