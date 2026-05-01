import { createClient } from 'redis';
import { logger } from '@/lib/logger';
import { env } from '@/lib/config/env';

const REALTIME_CHANNEL = 'realtime:notifications';
/** Sorted set: member = `${endUserId}|${leaseId}`, score = last heartbeat unix ms */
const REALTIME_LEASES_KEY = 'realtime:connections:leases';

/** Separator for composite lease member ({@link formatLiveLeaseMember}). */
export const LIVE_LEASE_MEMBER_SEP = '|' as const;
/** No heartbeat in this window → lease removed from Redis (override via `REALTIME_LEASE_MAX_STALE_MS`). */
const REALTIME_LEASE_MAX_STALE_MS = env.REALTIME_LEASE_MAX_STALE_MS;

/**
 * Interval for `/api/extension/live` to send an SSE keep-alive comment and refresh the Redis lease.
 *
 * Default 1 min — fewer pings than the old 15 s default. Some proxies idle-close around 30–60 s;
 * if SSE drops behind certain CDNs/LBs, lower `REALTIME_LIVE_HEARTBEAT_MS` (e.g. 15000).
 */
export const REALTIME_LIVE_LEASE_HEARTBEAT_MS = env.REALTIME_LIVE_HEARTBEAT_MS;
const REALTIME_COUNT_CHANNEL = 'realtime:connection_count';

/** JSON list of `{ id, domain }` for platforms; used by extension serve/live hot path */
const EXTENSION_PLATFORMS_KEY = 'extension:platforms:list';

/** Cached active campaign rows for extension serve/live paths */
const EXTENSION_CAMPAIGNS_KEY_ALL = 'extension:campaigns:active:all';
const EXTENSION_CAMPAIGNS_KEY_REDIRECTS = 'extension:campaigns:active:redirects';

/**
 * Shared domains list cache — the campaign-referenced canonical domains emitted in SSE `init.domains`
 * and `platforms_updated` / `campaign_updated` payloads.
 */

const EXTENSION_DOMAINS_KEY = 'extension:campaigns:domains';

/**
 * Redis `EX` TTL (seconds) for extension JSON caches — campaign rows, platforms list, domains list.
 * Twelve hours caps staleness if invalidation is missed; admin APIs still `DEL` keys on mutation.
 */
export const EXTENSION_JSON_CACHE_TTL_SEC = 12 * 60 * 60;

const EXTENSION_CAMPAIGNS_CACHE_TTL_SEC = EXTENSION_JSON_CACHE_TTL_SEC;
const EXTENSION_DOMAINS_CACHE_TTL_SEC = EXTENSION_JSON_CACHE_TTL_SEC;
const EXTENSION_PLATFORMS_CACHE_TTL_SEC = EXTENSION_JSON_CACHE_TTL_SEC;

export const EXTENSION_CAMPAIGNS_KEYS = {
  all: EXTENSION_CAMPAIGNS_KEY_ALL,
  redirects: EXTENSION_CAMPAIGNS_KEY_REDIRECTS,
} as const;
export type CampaignCacheKey = keyof typeof EXTENSION_CAMPAIGNS_KEYS;

export { REALTIME_CHANNEL, REALTIME_COUNT_CHANNEL };
export type CachedPlatformRow = { id: string; domain: string };

function getRedisUrl(): string | undefined {
  const url = env.REDIS_URL;
  return url && url.trim() !== '' ? url : undefined;
}

type RedisClient = Awaited<ReturnType<typeof createClient>>;

let _client: RedisClient | null = null;
let _clientPromise: Promise<RedisClient | null> | null = null;

/**
 * Get or create the singleton Redis client. Reused across all short-lived operations.
 * Returns null if REDIS_URL is not set (graceful degradation).
 */
export async function getRedisClient(): Promise<RedisClient | null> {
  const url = getRedisUrl();
  if (!url) return null;

  if (_client) return _client;
  if (_clientPromise) return _clientPromise;

  _clientPromise = (async () => {
    try {
      const client = createClient({ url }).on('error', (err) =>
        logger.error('[redis] client error', err)
      );
      await client.connect();
      _client = client;
      return client;
    } catch (err) {
      logger.error('[redis] failed to connect', err);
      _clientPromise = null;
      return null;
    }
  })();

  return _clientPromise;
}

async function setExtensionJsonCache(
  key: string,
  json: string,
  ttlSec: number | undefined
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    if (ttlSec !== undefined && ttlSec > 0) {
      await client.set(key, json, { EX: ttlSec });
    } else {
      await client.set(key, json);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Creates a new Redis client for long-lived connections (e.g. SSE subscribe).
 * Caller must call client.destroy() when done.
 * Use getRedisClient() for short-lived operations (publish, get, incr, decr).
 */
export async function createRedisClient(): Promise<RedisClient | null> {
  const url = getRedisUrl();
  if (!url) return null;

  const client = createClient({ url }).on('error', (err) =>
    logger.error('[redis] dedicated client error', err)
  );
  await client.connect();
  return client;
}

/**
 * Publish a message to the realtime notifications channel.
 * No-op if Redis is not configured.
 */
export async function publishRealtimeNotification(payload: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  await client.publish(REALTIME_CHANNEL, payload);
}

/**
 * Invalidate cached active platform list (call when platforms change).
 * No-op if Redis is not configured.
 */
export async function invalidatePlatformListCache(): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del(EXTENSION_PLATFORMS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Read active platforms from extension JSON cache (extension serve/live).
 * Returns null on miss or if Redis unavailable.
 */
export async function getCachedPlatformList(): Promise<CachedPlatformRow[] | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(EXTENSION_PLATFORMS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as CachedPlatformRow[];
  } catch {
    return null;
  }
}

/**
 * Store active platforms in Redis (optional TTL; see extension cache TTL constants in `redis.ts`).
 */
export async function setCachedPlatformList(rows: CachedPlatformRow[]): Promise<void> {
  await setExtensionJsonCache(
    EXTENSION_PLATFORMS_KEY,
    JSON.stringify(rows),
    EXTENSION_PLATFORMS_CACHE_TTL_SEC
  );
}

/**
 * Publish a platforms_updated event so extension SSE subscribers can refresh their domains.
 * Clears the platform-list cache so the next serve/live request reloads from DB.
 * No-op if Redis is not configured (cache helpers no-op too).
 */
export async function publishPlatformsUpdated(): Promise<void> {
  await Promise.all([
    invalidatePlatformListCache(),
    invalidateActiveCampaignCache(),
  ]);
  await publishRealtimeNotification(JSON.stringify({ type: 'platforms_updated' }));
}

/**
 * Read cached active campaign rows for the given key.
 * Generic over T so callers get typed results without a redis → campaign import cycle.
 */
export async function getCachedActiveCampaigns<T>(key: string): Promise<T[] | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as T[];
  } catch {
    return null;
  }
}

/**
 * Store active campaign rows in Redis (optional TTL via extension cache TTL constants).
 */
export async function setCachedActiveCampaigns<T>(key: string, rows: T[]): Promise<void> {
  await setExtensionJsonCache(key, JSON.stringify(rows), EXTENSION_CAMPAIGNS_CACHE_TTL_SEC);
}

/**
 * Invalidate all active-campaign cache entries (call on campaign create/update/delete).
 */
export async function invalidateActiveCampaignCache(): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del([
      EXTENSION_CAMPAIGNS_KEY_ALL,
      EXTENSION_CAMPAIGNS_KEY_REDIRECTS,
      EXTENSION_DOMAINS_KEY,
    ]);
  } catch {
    /* ignore */
  }
}

/**
 * Shared cache for the campaign-used canonical domain list. This is user-agnostic,
 * so SSE fan-out for `platforms_updated` / `campaign_updated` can reuse one DB read
 * across connected extension streams until invalidated or TTL expiry (when configured).
 */
export async function getCachedCampaignDomains(): Promise<string[] | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(EXTENSION_DOMAINS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((d): d is string => typeof d === 'string');
  } catch {
    return null;
  }
}

export async function setCachedCampaignDomains(domains: string[]): Promise<void> {
  await setExtensionJsonCache(
    EXTENSION_DOMAINS_KEY,
    JSON.stringify(domains),
    EXTENSION_DOMAINS_CACHE_TTL_SEC
  );
}

/**
 * Notify extension SSE listeners that campaign targeting may have changed.
 * Also invalidates the active-campaign Redis cache so the next serve request reloads from DB.
 */
export async function publishCampaignUpdated(campaignId: string): Promise<void> {
  await Promise.all([
    invalidateActiveCampaignCache(),
    publishRealtimeNotification(JSON.stringify({ type: 'campaign_updated', campaignId })),
  ]);
}

/** Admin changed redirect rows — extension SSE should refresh cached redirect rules. */
export async function publishRedirectsUpdated(): Promise<void> {
  await Promise.all([
    invalidateActiveCampaignCache(),
    publishRealtimeNotification(JSON.stringify({ type: 'redirects_updated' })),
  ]);
}


/**
 * Publish the current connection count to REALTIME_COUNT_CHANNEL so dashboard SSE subscribers get updates.
 * No-op if Redis is not configured.
 */
export async function publishConnectionCount(count: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  await client.publish(REALTIME_COUNT_CHANNEL, String(count));
}

/** Builds Redis sorted-set member for `/api/extension/live` leases. */
export function formatLiveLeaseMember(endUserId: string, leaseId: string): string {
  return `${endUserId}${LIVE_LEASE_MEMBER_SEP}${leaseId}`;
}

export type ParsedLiveLeaseMember =
  | { kind: 'full'; endUserId: string; leaseId: string }
  | { kind: 'legacy'; leaseId: string };

/**
 * Parses lease member strings: composite `userId|sessionId` or legacy single UUID before rollout.
 */
export function parseLiveLeaseMember(member: string): ParsedLiveLeaseMember | null {
  const trimmed = member.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(LIVE_LEASE_MEMBER_SEP);
  if (idx === -1) {
    return { kind: 'legacy', leaseId: trimmed };
  }
  const endUserId = trimmed.slice(0, idx).trim();
  const leaseId = trimmed.slice(idx + LIVE_LEASE_MEMBER_SEP.length).trim();
  if (!endUserId || !leaseId) return null;
  return { kind: 'full', endUserId, leaseId };
}

export type LiveConnectionSessionRow = {
  endUserId: string | null;
  leaseId: string;
  lastHeartbeatMs: number;
};

async function pruneStaleLiveLeases(client: RedisClient): Promise<void> {
  const cutoff = Date.now() - REALTIME_LEASE_MAX_STALE_MS;
  await client.zRemRangeByScore(REALTIME_LEASES_KEY, 0, cutoff);
}

async function liveLeaseCountAfterPrune(
  client: RedisClient
): Promise<{ count: number; pruned: boolean }> {
  const before = await client.zCard(REALTIME_LEASES_KEY);
  await pruneStaleLiveLeases(client);
  const count = Math.max(0, await client.zCard(REALTIME_LEASES_KEY));
  return { count, pruned: before > count };
}

/**
 * Register one extension live SSE connection (`member` = {@link formatLiveLeaseMember}).
 * Heartbeat with {@link refreshLiveConnectionLease} until {@link removeLiveConnectionLease} or stale.
 */
export async function registerLiveConnectionLease(connectionId: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  try {
    const now = Date.now();
    await client.zAdd(REALTIME_LEASES_KEY, { score: now, value: connectionId });
    const { count } = await liveLeaseCountAfterPrune(client);
    await publishConnectionCount(count);
    return count;
  } catch {
    return 0;
  }
}

/** Extend lease TTL (call periodically while the SSE is open). */
export async function refreshLiveConnectionLease(connectionId: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    const now = Date.now();
    await client.zAdd(REALTIME_LEASES_KEY, { score: now, value: connectionId });
  } catch {
    /* ignore */
  }
}

/** Remove lease when the SSE ends normally. Publishes updated count. */
export async function removeLiveConnectionLease(connectionId: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  try {
    await client.zRem(REALTIME_LEASES_KEY, connectionId);
    const { count } = await liveLeaseCountAfterPrune(client);
    await publishConnectionCount(count);
    return count;
  } catch {
    return 0;
  }
}

/**
 * Current live extension SSE connections. Prunes stale leases (no recent heartbeat).
 */
export async function getConnectionCount(): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  try {
    const { count, pruned } = await liveLeaseCountAfterPrune(client);
    if (pruned) {
      await publishConnectionCount(count);
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Clear all connection leases; publish 0 to dashboard subscribers.
 */
export async function resetConnectionCount(): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del(REALTIME_LEASES_KEY);
  } catch {
    /* ignore */
  }
  await publishConnectionCount(0);
}

/**
 * Snapshot of active extension SSE sessions (after pruning stale heartbeats).
 */
export async function listLiveConnectionSessions(): Promise<LiveConnectionSessionRow[]> {
  const client = await getRedisClient();
  if (!client) return [];
  try {
    await pruneStaleLiveLeases(client);
    const rows = await client.zRangeWithScores(REALTIME_LEASES_KEY, 0, -1);
    const result: LiveConnectionSessionRow[] = [];
    for (const row of rows) {
      const member = typeof row.value === 'string' ? row.value : String(row.value);
      const parsed = parseLiveLeaseMember(member);
      if (!parsed) continue;
      if (parsed.kind === 'full') {
        result.push({
          endUserId: parsed.endUserId,
          leaseId: parsed.leaseId,
          lastHeartbeatMs: Number(row.score),
        });
      } else {
        result.push({
          endUserId: null,
          leaseId: parsed.leaseId,
          lastHeartbeatMs: Number(row.score),
        });
      }
    }
    return result;
  } catch {
    return [];
  }
}
