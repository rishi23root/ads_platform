import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL;
const REALTIME_CHANNEL = 'realtime:notifications';
const REALTIME_COUNT_KEY = 'realtime:connections';
const REALTIME_COUNT_CHANNEL = 'realtime:connection_count';

export { REALTIME_CHANNEL, REALTIME_COUNT_KEY, REALTIME_COUNT_CHANNEL };

function getRedisUrl(): string | undefined {
  return REDIS_URL && REDIS_URL.trim() !== '' ? REDIS_URL : undefined;
}

/**
 * Creates a new Redis client and connects it. Caller must call client.destroy() when done.
 * Returns null if REDIS_URL is not set (graceful degradation).
 */
export async function createRedisClient(): Promise<Awaited<ReturnType<typeof createClient>> | null> {
  const url = getRedisUrl();
  if (!url) return null;

  const client = createClient({ url })
    .on('error', (err) => console.error('[redis]', err));

  await client.connect();
  return client;
}

/**
 * Publish a message to the realtime notifications channel.
 * No-op if Redis is not configured.
 */
export async function publishRealtimeNotification(payload: string): Promise<void> {
  const client = await createRedisClient();
  if (!client) return;
  try {
    await client.publish(REALTIME_CHANNEL, payload);
  } finally {
    await client.destroy();
  }
}

/**
 * Publish the current connection count to REALTIME_COUNT_CHANNEL so dashboard SSE subscribers get updates.
 * No-op if Redis is not configured.
 */
export async function publishConnectionCount(count: number): Promise<void> {
  const client = await createRedisClient();
  if (!client) return;
  try {
    await client.publish(REALTIME_COUNT_CHANNEL, String(count));
  } finally {
    await client.destroy();
  }
}

/**
 * Increment the live connection count. Returns the new count, or 0 if Redis unavailable.
 */
export async function incrConnectionCount(): Promise<number> {
  const client = await createRedisClient();
  if (!client) return 0;
  try {
    const count = await client.incr(REALTIME_COUNT_KEY);
    return count;
  } finally {
    await client.destroy();
  }
}

/**
 * Decrement the live connection count. Returns the new count, or 0 if Redis unavailable.
 */
export async function decrConnectionCount(): Promise<number> {
  const client = await createRedisClient();
  if (!client) return 0;
  try {
    const count = await client.decr(REALTIME_COUNT_KEY);
    return Math.max(0, count);
  } finally {
    await client.destroy();
  }
}

/**
 * Get the current live connection count. Returns 0 if Redis unavailable or key not set.
 */
export async function getConnectionCount(): Promise<number> {
  const client = await createRedisClient();
  if (!client) return 0;
  try {
    const value = await client.get(REALTIME_COUNT_KEY);
    return value ? parseInt(value, 10) : 0;
  } catch {
    return 0;
  } finally {
    await client.destroy();
  }
}
