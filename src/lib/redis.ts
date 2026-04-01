import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL;
const REALTIME_CHANNEL = 'realtime:notifications';
const REALTIME_COUNT_KEY = 'realtime:connections';
const REALTIME_COUNT_CHANNEL = 'realtime:connection_count';

/** JSON list of `{ id, domain }` for platforms; used by extension ad-block hot path */
const EXTENSION_PLATFORMS_KEY = 'extension:platforms:list';
const EXTENSION_PLATFORMS_TTL_SEC = 60;

export { REALTIME_CHANNEL, REALTIME_COUNT_KEY, REALTIME_COUNT_CHANNEL };
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
 * Notify extension SSE listeners that campaign targeting may have changed.
 */
export async function publishCampaignUpdated(campaignId: string): Promise<void> {
  await publishRealtimeNotification(
    JSON.stringify({ type: 'campaign_updated', campaignId })
  );
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
 * After client-reported events, notify this user's SSE connections of new frequency count.
 * Handlers must filter by `endUserId` so other users do not receive foreign updates.
 */
export async function publishFrequencyUpdated(params: {
  endUserId: string;
  campaignId: string;
  count: number;
}): Promise<void> {
  await publishRealtimeNotification(
    JSON.stringify({
      type: 'frequency_updated',
      endUserId: params.endUserId,
      campaignId: params.campaignId,
      count: params.count,
    })
  );
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

/**
 * Increment the live connection count. Returns the new count, or 0 if Redis unavailable.
 */
export async function incrConnectionCount(): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  try {
    return await client.incr(REALTIME_COUNT_KEY);
  } catch {
    return 0;
  }
}

/**
 * Decrement the live connection count. Returns the new count, or 0 if Redis unavailable.
 */
export async function decrConnectionCount(): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  try {
    const count = await client.decr(REALTIME_COUNT_KEY);
    return Math.max(0, count);
  } catch {
    return 0;
  }
}

/**
 * Get the current live connection count. Returns 0 if Redis unavailable or key not set.
 */
export async function getConnectionCount(): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  try {
    const value = await client.get(REALTIME_COUNT_KEY);
    return value ? parseInt(value, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Reset the live connection count to 0 and publish to dashboard subscribers.
 * Use on server startup or for manual correction when the count is stale.
 */
export async function resetConnectionCount(): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  await client.set(REALTIME_COUNT_KEY, '0');
  await publishConnectionCount(0);
}
