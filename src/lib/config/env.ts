import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_POOL_MAX: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  // Admin Authentication
  ADMIN_USERNAME: z.string().min(1, 'ADMIN_USERNAME is required'),
  ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
});

function validateEnv() {
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

export const env = validateEnv();
