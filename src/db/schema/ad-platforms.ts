import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { ads } from './ads';
import { platforms } from './platforms';

export const adPlatforms = pgTable(
  'ad_platforms',
  {
    adId: uuid('ad_id')
      .notNull()
      .references(() => ads.id, { onDelete: 'cascade' }),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.adId, t.platformId] })]
);

export type AdPlatform = typeof adPlatforms.$inferSelect;
export type NewAdPlatform = typeof adPlatforms.$inferInsert;
