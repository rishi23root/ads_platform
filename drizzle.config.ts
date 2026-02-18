import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { normalizeDatabaseUrl } from './src/lib/db/connection-url';

dotenv.config({ path: '.env.local' });

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: normalizeDatabaseUrl(rawUrl),
  },
  verbose: true,
  strict: true,
});
