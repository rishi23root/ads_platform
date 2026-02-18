/**
 * Runs once when the Next.js server starts (dev/start only, not during build).
 * We run DB migrations and seed admin user here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
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
