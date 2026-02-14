/**
 * Seed default admin user when no users exist.
 * Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local to enable.
 * Run: npm run db:seed-admin
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('Skipping admin seed: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local');
    process.exit(0);
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
    console.log('Users already exist. Skipping admin seed.');
    process.exit(0);
    return;
  }

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: 'Admin',
      },
    });

    if (result.error) {
      console.error('Failed to create admin:', result.error.message);
      process.exit(1);
    }

    if (result.data?.user) {
      await db.update(user).set({ role: 'admin' }).where(eq(user.id, result.data.user.id));
      console.log(`Admin user created: ${email}`);
    }
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }

  process.exit(0);
}

seedAdmin();
