declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    REDIS_URL: string;
    NODE_ENV: 'development' | 'production' | 'test';
    DATABASE_POOL_MAX?: string;
    REDIS_TTL_DEFAULT?: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_BASE_URL?: string;
    BETTER_AUTH_URL?: string;
  }
}
