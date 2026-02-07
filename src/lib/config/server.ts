import 'server-only';
import { env } from './env';

export const serverConfig = {
  database: {
    url: env.DATABASE_URL,
    poolMax: env.DATABASE_POOL_MAX ?? 10,
  },
  nodeEnv: env.NODE_ENV,
} as const;
