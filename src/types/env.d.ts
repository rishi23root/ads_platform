declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    REDIS_URL: string;
    NODE_ENV: 'development' | 'production' | 'test';
    DATABASE_POOL_MAX?: string;
    REDIS_TTL_DEFAULT?: string;
    ADMIN_USERNAME: string;
    ADMIN_PASSWORD: string;
    JWT_SECRET: string;
  }
}
