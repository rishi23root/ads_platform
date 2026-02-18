import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL;
const REALTIME_CHANNEL = 'realtime:notifications';
const REALTIME_COUNT_KEY = 'realtime:connections';
const REALTIME_COUNT_CHANNEL = 'realtime:connection_count';

export { REALTIME_CHANNEL, REALTIME_COUNT_KEY, REALTIME_COUNT_CHANNEL };

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
