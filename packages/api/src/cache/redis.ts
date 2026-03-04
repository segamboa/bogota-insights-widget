import Redis from 'ioredis';
import { config } from 'dotenv';

config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    console.log('Redis connected');
  } catch (err: any) {
    // ioredis may already be connected
    if (err.message?.includes('already')) return;
    console.error('Failed to connect to Redis:', err.message);
  }
}

export async function getCache(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, 'EX', ttlSeconds);
  } catch (err) {
    console.error('Redis set error:', err);
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error('Redis delete error:', err);
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function shutdown(): Promise<void> {
  await redis.quit();
}

export { redis };
