import path from 'path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Match local dev: BETTER_AUTH_BASE_URL / BETTER_AUTH_URL in .env.local (Next loads it; Vitest does not by default).
// Extension integration tests use that base URL via tests/support/extension-test-base-url.ts.
loadEnv({ path: path.resolve(__dirname, '.env') });
loadEnv({ path: path.resolve(__dirname, '.env.local'), override: true });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60_000,
    // Extension integration tests share fixed end-user emails and Bearer sessions; parallel files
    // invalidate each other's tokens (single-session-per-user) and interleave DB-side frequency.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/mocks/server-only.ts'),
    },
  },
});
