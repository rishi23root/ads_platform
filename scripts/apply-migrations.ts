/**
 * Load `.env` / `.env.local` and run the same migration pipeline as instrumentation.
 * Usage: pnpm db:migrate:app
 */
import { loadCliEnv } from '../src/lib/db/load-cli-env';
import { runMigrations } from '../src/lib/db/run-migrate';

loadCliEnv({ verbose: true });

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
