import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_POOL_MAX: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_BASE_URL: z.string().url().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  // Optional: seed default admin when no users exist
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`).join('\n');
      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
}

/**
 * Lazily validated env. During `next build` the env vars don't exist, so
 * validation fails — we fall back to the raw process.env value (undefined).
 * At runtime the vars are present, validation succeeds, and the result is cached.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_env) {
      try {
        _env = validateEnv();
      } catch {
        // Build time — env vars aren't available. Return the raw value
        // (undefined). No real DB/auth calls happen during build.
        return process.env[prop];
      }
    }
    return _env[prop as keyof Env];
  },
});
