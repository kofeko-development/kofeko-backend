import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../common/logger/logger';

let client: Redis | null = null;
let disabled = false;

export function getRedisClient(): Redis | null {
  if (disabled || !env.REDIS_URL) return null;
  if (client) return client;

  try {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    client.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis connection error — falling back to in-memory cache');
    });

    void client.connect().catch((err) => {
      logger.warn({ err: err.message }, 'Redis unavailable — using in-memory cache only');
      disabled = true;
      client = null;
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Redis');
    disabled = true;
    client = null;
  }

  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

export type RedisHealthStatus = {
  configured: boolean;
  status: 'up' | 'down' | 'not_configured';
  latencyMs?: number;
  error?: string;
};

const HEALTH_CHECK_TIMEOUT_MS = 3000;

export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  if (!env.REDIS_URL) {
    return { configured: false, status: 'not_configured' };
  }

  const redis = getRedisClient();
  if (!redis) {
    return {
      configured: true,
      status: 'down',
      error: 'Redis client unavailable',
    };
  }

  const start = Date.now();
  try {
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Redis health check timed out')), HEALTH_CHECK_TIMEOUT_MS);
      }),
    ]);

    if (result !== 'PONG') {
      return {
        configured: true,
        status: 'down',
        error: `Unexpected ping response: ${result}`,
      };
    }

    return {
      configured: true,
      status: 'up',
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      configured: true,
      status: 'down',
      error: err instanceof Error ? err.message : 'Redis ping failed',
    };
  }
}
