import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { serverConfig } from '@/lib/config/server';
import * as schema from './schema';

let client: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;

function getDatabase() {
  if (db) {
    return db;
  }

  if (!client) {
    const connectionString = serverConfig.database.url;
    const poolMax = serverConfig.database.poolMax;

    client = postgres(connectionString, {
      max: poolMax,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  db = drizzle(client, { schema });
  return db;
}

export const database = getDatabase();

// Graceful shutdown handler for production
if (typeof process !== 'undefined') {
  const shutdown = async () => {
    if (client) {
      await client.end();
      client = null;
      db = null;
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
