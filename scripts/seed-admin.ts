/**
 * Seed default admin user when no users exist.
 * Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local to enable.
 * Run: npm run db:seed-admin (or runs automatically on dev/start via instrumentation)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('Skipping admin seed: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local');
    return;
  }

  // Dynamic import to avoid loading server-only during script init
  const authModule = await import('../src/lib/auth');
  const auth = authModule.auth;
  const dbModule = await import('../src/db');
  const db = dbModule.database;
  const schemaModule = await import('../src/db/schema');
  const { user } = schemaModule;
  const { eq, count } = await import('drizzle-orm');

  const [row] = await db.select({ n: count() }).from(user);
  if (row && row.n > 0) {
    return;
  }

  const result = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: 'Admin',
    },
  });

  if ('error' in result && result.error) {
    const err = result.error as { message?: string };
    throw new Error(err.message ?? String(err));
  }

  if ('user' in result && result.user) {
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, result.user.id));
    console.log(`Admin user created: ${email}`);
  }
}

// Run when executed directly (pnpm db:seed-admin), not when imported by instrumentation
if (process.argv[1]?.includes('seed-admin')) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
