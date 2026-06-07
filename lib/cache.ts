/**
 * Cloudflare KV-backed cache with explicit TTL support.
 *
 * KV is globally replicated and survives cold starts, making it the correct
 * choice for caching short-lived matchup results at the edge.
 *
 * Usage:
 *   const result = await getCache<AnalyzeMatchupOutput>(env, key);
 *   await setCache(env, key, result, { ttlSeconds: 300 });
 */

import type { Env } from "../src/index.js";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

export interface CacheOptions {
  /** Time-to-live in seconds. Defaults to 300 (5 minutes). */
  ttlSeconds?: number;
}

/**
 * Retrieve a cached value from KV. Returns `null` on cache miss or error.
 */
export async function getCache<T>(env: Env, key: string): Promise<T | null> {
  try {
    const value = await env.BSI_CACHE_KV.get(key, { type: "json" });
    return value as T | null;
  } catch (err) {
    console.error(`[Cache GET error] ${key}`, err);
    return null;
  }
}

/**
 * Store a value in KV with an optional TTL.
 * Serialises the value as JSON automatically.
 */
export async function setCache<T>(
  env: Env,
  key: string,
  value: T,
  options: CacheOptions = {},
): Promise<void> {
  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  try {
    await env.BSI_CACHE_KV.put(key, JSON.stringify(value), {
      expirationTtl: ttl,
    });
  } catch (err) {
    console.error(`[Cache SET error] ${key}`, err);
  }
}

/**
 * Delete a key from KV. Useful for manual cache invalidation.
 */
export async function deleteCache(env: Env, key: string): Promise<void> {
  try {
    await env.BSI_CACHE_KV.delete(key);
  } catch (err) {
    console.error(`[Cache DELETE error] ${key}`, err);
  }
}

/**
 * Generate a canonical matchup cache key from team IDs and an optional date.
 *
 * Example: `matchup_texas_tcu_2025-05-10`
 */
export function matchupCacheKey(
  team1Id: string,
  team2Id: string,
  date?: string,
): string {
  const d = date ?? "current";
  return `matchup_${team1Id}_${team2Id}_${d}`;
}
