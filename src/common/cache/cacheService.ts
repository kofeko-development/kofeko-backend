import { getRedisClient } from '../../config/redis';
import { logger } from '../logger/logger';

type MemoryEntry = { value: string; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();

const DEFAULT_TTL_SEC = 60;

function pruneMemory(key: string): void {
  const entry = memoryStore.get(key);
  if (entry && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
  }
}

async function memoryGet<T>(key: string): Promise<T | null> {
  pruneMemory(key);
  const entry = memoryStore.get(key);
  if (!entry) return null;
  try {
    return JSON.parse(entry.value) as T;
  } catch {
    memoryStore.delete(key);
    return null;
  }
}

async function memorySet(key: string, value: unknown, ttlSec: number): Promise<void> {
  memoryStore.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

async function memoryDel(key: string): Promise<void> {
  memoryStore.delete(key);
}

async function memoryDelByPrefix(prefix: string): Promise<void> {
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
}

export const cacheKeys = {
  staffSession: (tenantId: string, userId: string) => `kofeko:session:staff:${tenantId}:${userId}`,
  candidateSession: (tenantId: string, userId: string) => `kofeko:session:candidate:${tenantId}:${userId}`,
  superAdminSession: (userId: string) => `kofeko:session:superadmin:${userId}`,
  jobsList: (tenantId: string, queryKey: string) => `kofeko:jobs:${tenantId}:${queryKey}`,
  jobDetail: (tenantId: string, jobId: string) => `kofeko:job:${tenantId}:${jobId}`,
  pipelinesList: (tenantId: string, queryKey: string) => `kofeko:pipelines:${tenantId}:${queryKey}`,
  companyProfile: (tenantId: string) => `kofeko:company:${tenantId}`,
  portalJobsAll: (queryKey: string) => `kofeko:portal:jobs:all:${queryKey}`,
  portalJobDetail: (jobId: string) => `kofeko:portal:job:${jobId}`,
  portalJobsByTenant: (tenantSlug: string, queryKey: string) => `kofeko:portal:jobs:${tenantSlug}:${queryKey}`,
  portalJobByTenant: (tenantSlug: string, jobId: string) => `kofeko:portal:job:${tenantSlug}:${jobId}`,
  myApplications: (candidateId: string, queryKey: string) => `kofeko:applications:${candidateId}:${queryKey}`,
  myApplicationDetail: (candidateId: string, pipelineId: string) =>
    `kofeko:application:${candidateId}:${pipelineId}`,
  teamList: (tenantId: string, queryKey: string) => `kofeko:team:${tenantId}:${queryKey}`,
  candidatesList: (tenantId: string, queryKey: string) => `kofeko:candidates:${tenantId}:${queryKey}`,
  linkedInStatus: (userId: string) => `kofeko:linkedin:${userId}`,
};

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();
    if (redis) {
      try {
        const raw = await redis.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch (err) {
        logger.warn({ key, err }, 'Redis GET failed');
      }
    }
    return memoryGet<T>(key);
  },

  async set(key: string, value: unknown, ttlSec = DEFAULT_TTL_SEC): Promise<void> {
    const redis = getRedisClient();
    const serialized = JSON.stringify(value);
    if (redis) {
      try {
        await redis.set(key, serialized, 'EX', ttlSec);
        return;
      } catch (err) {
        logger.warn({ key, err }, 'Redis SET failed');
      }
    }
    await memorySet(key, value, ttlSec);
  },

  async del(key: string): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.del(key);
      } catch (err) {
        logger.warn({ key, err }, 'Redis DEL failed');
      }
    }
    await memoryDel(key);
  },

  async delByPrefix(prefix: string): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
      try {
        let cursor = '0';
        do {
          const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
          cursor = next;
          if (keys.length > 0) await redis.del(...keys);
        } while (cursor !== '0');
      } catch (err) {
        logger.warn({ prefix, err }, 'Redis SCAN/DEL failed');
      }
    }
    await memoryDelByPrefix(prefix);
  },

  async getOrSet<T>(key: string, ttlSec: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSec);
    return value;
  },

  async invalidateStaffSession(tenantId: string, userId: string): Promise<void> {
    await this.del(cacheKeys.staffSession(tenantId, userId));
  },

  async invalidateCandidateSession(tenantId: string, candidateId: string): Promise<void> {
    await this.del(cacheKeys.candidateSession(tenantId, candidateId));
  },

  async invalidateTenantJobs(tenantId: string): Promise<void> {
    await this.delByPrefix(`kofeko:jobs:${tenantId}:`);
  },

  async invalidateJob(tenantId: string, jobId: string): Promise<void> {
    await this.del(cacheKeys.jobDetail(tenantId, jobId));
    await this.invalidateTenantJobs(tenantId);
  },

  async invalidateTenantPipelines(tenantId: string, jobId?: string): Promise<void> {
    if (jobId) {
      await this.delByPrefix(`kofeko:pipelines:${tenantId}:${jobId}:`);
    }
    await this.delByPrefix(`kofeko:pipelines:${tenantId}:`);
  },

  async invalidateCompany(tenantId: string): Promise<void> {
    await this.del(cacheKeys.companyProfile(tenantId));
  },

  async invalidatePortalJobs(jobId?: string): Promise<void> {
    await this.delByPrefix('kofeko:portal:jobs:');
    if (jobId) {
      await this.del(cacheKeys.portalJobDetail(jobId));
      await this.delByPrefix('kofeko:portal:job:');
    }
  },

  async invalidateMyApplications(candidateId: string, pipelineId?: string): Promise<void> {
    await this.delByPrefix(`kofeko:applications:${candidateId}:`);
    if (pipelineId) {
      await this.del(cacheKeys.myApplicationDetail(candidateId, pipelineId));
    }
  },

  async invalidateTeamList(tenantId: string): Promise<void> {
    await this.delByPrefix(`kofeko:team:${tenantId}:`);
  },

  async invalidateCandidatesList(tenantId: string): Promise<void> {
    await this.delByPrefix(`kofeko:candidates:${tenantId}:`);
  },

  async invalidateLinkedInStatus(userId: string): Promise<void> {
    await this.del(cacheKeys.linkedInStatus(userId));
  },
};
