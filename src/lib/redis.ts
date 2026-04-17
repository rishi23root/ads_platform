import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL;
const REALTIME_CHANNEL = 'realtime:notifications';
/** @deprecated Legacy string counter; removed on reset. Active count uses REALTIME_LEASES_KEY. */
const REALTIME_COUNT_KEY = 'realtime:connections';
/** Sorted set: member = lease id, score = last heartbeat unix ms */
const REALTIME_LEASES_KEY = 'realtime:connections:leases';
/** If no heartbeat refresh in this window, the lease is dropped (crashed server / lost TCP). */
const REALTIME_LEASE_MAX_STALE_MS = 120_000;

/** Interval for `/api/extension/live` to refresh the Redis lease while the stream stays open. */
export const REALTIME_LIVE_LEASE_HEARTBEAT_MS = 40_000;
const REALTIME_COUNT_CHANNEL = 'realtime:connection_count';

/** JSON list of `{ id, domain }` for platforms; used by extension ad-block hot path */
const EXTENSION_PLATFORMS_KEY = 'extension:platforms:list';
const EXTENSION_PLATFORMS_TTL_SEC = 60;

/** Cached active campaign rows for extension serve/live paths */
const EXTENSION_CAMPAIGNS_KEY_ALL = 'extension:campaigns:active:all';
const EXTENSION_CAMPAIGNS_KEY_REDIRECTS = 'extension:campaigns:active:redirects';
const EXTENSION_CAMPAIGNS_TTL_SEC = 20;

export const EXTENSION_CAMPAIGNS_KEYS = {
  all: EXTENSION_CAMPAIGNS_KEY_ALL,
  redirects: EXTENSION_CAMPAIGNS_KEY_REDIRECTS,
} as const;
export type CampaignCacheKey = keyof typeof EXTENSION_CAMPAIGNS_KEYS;

export { REALTIME_CHANNEL, REALTIME_COUNT_CHANNEL };
export type CachedPlatformRow = { id: string; domain: string };

function getRedisUrl(): string | undefined {
  return REDIS_URL && REDIS_URL.trim() !== '' ? REDIS_URL : undefined;
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
        console.error('[redis]', err)
      );
      await client.connect();
      _client = client;
      return client;
    } catch (err) {
      console.error('[redis] Failed to connect:', err);
      _clientPromise = null;
      return null;
    }
  })();

  return _clientPromise;
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
    console.error('[redis]', err)
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
 * Read active platforms from short-lived cache (extension ad-block).
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
 * Store active platforms in Redis with TTL.
 */
export async function setCachedPlatformList(rows: CachedPlatformRow[]): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.set(EXTENSION_PLATFORMS_KEY, JSON.stringify(rows), {
      EX: EXTENSION_PLATFORMS_TTL_SEC,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Publish a platforms_updated event so extension SSE subscribers can refresh their domains.
 * Clears the platform-list cache so the next ad-block request reloads from DB.
 * No-op if Redis is not configured (cache helpers no-op too).
 */
export async function publishPlatformsUpdated(): Promise<void> {
  await invalidatePlatformListCache();
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
 * Store active campaign rows in Redis with a short TTL.
 */
export async function setCachedActiveCampaigns<T>(key: string, rows: T[]): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(rows), { EX: EXTENSION_CAMPAIGNS_TTL_SEC });
  } catch {
    /* ignore */
  }
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
    ]);
  } catch {
    /* ignore */
  }
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
  await publishRealtimeNotification(JSON.stringify({ type: 'redirects_updated' }));
}

/** Admin changed ad creative rows — informational for extension cache. */
export async function publishAdsUpdated(): Promise<void> {
  await publishRealtimeNotification(JSON.stringify({ type: 'ads_updated' }));
}

/** Admin changed notification creative rows — informational for extension cache. */
export async function publishNotificationsUpdated(): Promise<void> {
  await publishRealtimeNotification(JSON.stringify({ type: 'notifications_updated' }));
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
 * Register one extension live SSE connection. Heartbeat with {@link refreshLiveConnectionLease}
 * until {@link removeLiveConnectionLease} or the lease goes stale.
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
 * Clear all connection leases and the legacy counter key; publish 0 to dashboard subscribers.
 */
export async function resetConnectionCount(): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del([REALTIME_LEASES_KEY, REALTIME_COUNT_KEY]);
  } catch {
    /* ignore */
  }
  await publishConnectionCount(0);
}
