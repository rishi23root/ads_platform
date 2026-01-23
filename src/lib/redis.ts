import 'server-only';
import { createClient } from 'redis';
import { serverConfig } from './config/server';

let redisClient: ReturnType<typeof createClient> | null = null;

function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const client = createClient({
    url: serverConfig.redis.url,
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Redis Client Connected');
  });

  client.on('reconnecting', () => {
    console.log('Redis Client Reconnecting');
  });

  // Connect in the background
  client.connect().catch((err) => {
    console.error('Failed to connect to Redis:', err);
  });

  redisClient = client;
  return redisClient;
}

export const redis = getRedisClient();

// Redis utility functions
export const redisUtils = {
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.get(key);
  },

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    const ttlSeconds = ttl ?? serverConfig.redis.ttlDefault;
    await client.setEx(key, ttlSeconds, value);
  },

  async del(key: string): Promise<number> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.del(key);
  },

  async exists(key: string): Promise<number> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.exists(key);
  },

  async expire(key: string, seconds: number): Promise<boolean> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    const result = await client.expire(key, seconds);
    return result === 1;
  },

  async ttl(key: string): Promise<number> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.ttl(key);
  },

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.sAdd(key, members);
  },

  async smembers(key: string): Promise<string[]> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.sMembers(key);
  },

  async srem(key: string, ...members: string[]): Promise<number> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.sRem(key, members);
  },

  async sismember(key: string, member: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    const result = await client.sIsMember(key, member);
    return result === 1;
  },

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.zAdd(key, { score, value: member });
  },

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.zRange(key, start, stop);
  },

  async zrem(key: string, ...members: string[]): Promise<number> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.zRem(key, members);
  },

  async zscore(key: string, member: string): Promise<number | null> {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    return client.zScore(key, member);
  },
};
