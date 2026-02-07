/**
 * Runs once when the Next.js server starts. We run DB migrations here so
 * tables exist whether you start the app with `pnpm dev` or Docker.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('./src/lib/db/run-migrate');
    await runMigrations();
  }
}
