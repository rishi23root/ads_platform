/**
 * Load `.env` then `.env.local` (override) from the project root for CLI tools.
 * Next.js loads these automatically; Node CLIs (drizzle-kit, tsx scripts) do not.
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

export function loadCliEnv(options?: { verbose?: boolean }): void {
  const root = process.cwd();
  for (const file of ['.env', '.env.local'] as const) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) {
      if (options?.verbose) {
        console.log(`[env] skip ${file} (not found)`);
      }
      continue;
    }
    const override = file === '.env.local';
    const result = dotenv.config({ path: full, override });
    const n = result.parsed ? Object.keys(result.parsed).length : 0;
    if (options?.verbose) {
      console.log(`[env] loaded ${file}${override ? ' (overrides earlier)' : ''} — ${n} variable(s)`);
    }
  }
}
