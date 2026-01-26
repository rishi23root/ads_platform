import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const extensionUsers = pgTable('extension_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  visitorId: varchar('visitor_id', { length: 255 }).notNull().unique(), // unique ID from extension
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  totalRequests: integer('total_requests').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ExtensionUser = typeof extensionUsers.$inferSelect;
export type NewExtensionUser = typeof extensionUsers.$inferInsert;
