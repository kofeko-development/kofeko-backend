import { env } from '../../config/env';

/** Session / auth profile payloads — keep short so permission changes show quickly. */
export const CACHE_SESSION_TTL = env.CACHE_TTL_SECONDS;

/** List endpoints (jobs, portal, team, applications, pipelines). */
export const CACHE_LIST_TTL = env.CACHE_LIST_TTL_SECONDS;

/** Slowly changing data (company profile, LinkedIn status). */
export const CACHE_STATIC_TTL = env.CACHE_STATIC_TTL_SECONDS;
