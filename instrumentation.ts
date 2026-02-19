/**
 * Runs once when the Next.js server starts (dev/start only, not during build).
 * We run DB migrations and seed admin user here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Debug: verify env loading (remove after confirming)
    const dbUrl = process.env.DATABASE_URL;
    const dbHost = dbUrl ? new URL(dbUrl.replace(/^postgresql:\/\//, 'http://')).hostname : 'NOT SET';
    const envCheck = {
      DATABASE_URL: dbUrl ? '✓' : '✗',
      'DB host': dbHost,
      REDIS_URL: process.env.REDIS_URL ? '✓' : '✗',
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ? '✓' : '✗',
    };
    console.log('[ENV]', envCheck);
    const { runMigrations } = await import('./src/lib/db/run-migrate');
    await runMigrations();

    try {
      const { seedAdmin } = await import('./scripts/seed-admin');
      await seedAdmin();
    } catch (err) {
      console.error('Admin seed failed:', err);
    }

    try {
      const { resetConnectionCount } = await import('./src/lib/redis');
      await resetConnectionCount();
    } catch (err) {
      console.error('Redis connection count reset failed:', err);
    }
  }
}
