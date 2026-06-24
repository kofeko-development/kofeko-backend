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
