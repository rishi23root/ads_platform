import { z } from 'zod';

/**
 * Central environment validation. Every env var read anywhere in the app should go through
 * this schema so a misconfiguration surfaces as a single clear error instead of scattered
 * `undefined` behaviour deep in business logic.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_POOL_MAX: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_BASE_URL: z.string().url().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  // Optional: seed default admin when no users exist
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  // Redis (optional; extension caching and rate limiting degrade gracefully when absent).
  REDIS_URL: z
    .string()
    .refine(
      (v) => !v || /^rediss?:\/\//.test(v),
      'REDIS_URL must start with redis:// or rediss://'
    )
    .optional(),
  // Extension session lifetime (days). Accepts either a number or numeric string.
  ENDUSER_SESSION_DAYS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 30))
    .pipe(z.number().int().positive().max(3650)),
  // SSE heartbeat cadence (ms). Lower values keep idle proxies alive; higher values reduce chatter.
  REALTIME_LIVE_HEARTBEAT_MS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 15_000))
    .pipe(z.number().int().positive().max(600_000)),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;
let _lastError: z.ZodError | null = null;

function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);
    _lastError = null;
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      _lastError = error;
      const missingVars = error.issues
        .map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
}

/**
 * Lazily validated env.
 *
 * At build time (`next build`) secrets aren't available, so we swallow the validation error on
 * first access and return raw `process.env[prop]` — no real DB/auth calls happen during build.
 * At runtime we re-attempt validation on every access until it succeeds, so a misconfigured
 * runtime fails fast with the first Zod error instead of silently coercing to `undefined`.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (_env) {
      return _env[prop as keyof Env];
    }
    try {
      _env = validateEnv();
      return _env[prop as keyof Env];
    } catch (err) {
      // Build phase: NEXT_PHASE is set; return raw value so static analysis passes.
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        return process.env[prop];
      }
      // Runtime failure: re-throw so the caller sees the misconfiguration instead of
      // silently reading an `undefined` secret.
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
});

/**
 * Eager validator — call in bootstrapping code (e.g. `instrumentation.ts`) when you want
 * a single "crash early on bad config" moment instead of lazy validation per-accessor.
 */
export function ensureEnv(): Env {
  if (_env) return _env;
  return validateEnv();
}

/** For diagnostic endpoints: expose the last validation error without throwing. */
export function lastEnvValidationError(): z.ZodError | null {
  return _lastError;
}
