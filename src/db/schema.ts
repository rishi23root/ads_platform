/**
 * Adwarden MVP - Single schema file
 * Campaign-centric: 1 ad OR 1 notification OR 1 redirect per campaign, platforms on campaigns only
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  time,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

// ============ Better Auth ============
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const user = pgTable('user', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: varchar('image', { length: 255 }),
  banned: boolean('banned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  role: userRoleEnum('role').notNull().default('user'),
});

export const session = pgTable('session', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: varchar('user_agent', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: varchar('scope', { length: 255 }),
  idToken: text('id_token'),
  password: varchar('password', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Platforms ============
export const platforms = pgTable('platforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Ads (content only, no platform/status/dates) ============
export const ads = pgTable('ads', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  targetUrl: text('target_url'),
  htmlCode: text('html_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Notifications (content only, no dates) ============
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  ctaLink: text('cta_link'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Redirects (content: source domain + destination URL) ============
export const redirects = pgTable('redirects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  sourceDomain: varchar('source_domain', { length: 255 }).notNull(),
  includeSubdomains: boolean('include_subdomains').notNull().default(false),
  destinationUrl: text('destination_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Placeholder Better Auth user id: campaigns reassigned here when creator is deleted */
export const SYSTEM_USER_ID = 'SYSTEM';

// ============ Campaigns ============
export const campaignTypeEnum = pgEnum('campaign_type', ['ads', 'popup', 'notification', 'redirect']);
export const frequencyTypeEnum = pgEnum('frequency_type', [
  'full_day',
  'time_based',
  'only_once',
  'always',
  'specific_count',
]);
export const targetAudienceEnum = pgEnum('target_audience', ['new_users', 'all_users']);
export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'inactive', 'scheduled', 'expired']);

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    targetAudience: targetAudienceEnum('target_audience').notNull().default('all_users'),
    campaignType: campaignTypeEnum('campaign_type').notNull(),
    frequencyType: frequencyTypeEnum('frequency_type').notNull(),
    frequencyCount: integer('frequency_count'),
    timeStart: time('time_start'),
    timeEnd: time('time_end'),
    status: campaignStatusEnum('status').notNull().default('inactive'),
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    adId: uuid('ad_id').references(() => ads.id, { onDelete: 'set null' }),
    notificationId: uuid('notification_id').references(() => notifications.id, { onDelete: 'set null' }),
    redirectId: uuid('redirect_id').references(() => redirects.id, { onDelete: 'set null' }),
    /** Target platforms (empty = all domains for notification/redirect; ads/popup must set at least one in app validation) */
    platformIds: uuid('platform_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    /** Target ISO country codes (empty = all countries) */
    countryCodes: varchar('country_codes', { length: 2 })
      .array()
      .notNull()
      .default(sql`'{}'::varchar(2)[]`),
    createdBy: varchar('created_by', { length: 255 })
      .notNull()
      .default(SYSTEM_USER_ID)
      .references(() => user.id, { onDelete: 'set default' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('campaigns_ad_id_idx').on(t.adId),
    index('campaigns_notification_id_idx').on(t.notificationId),
    index('campaigns_redirect_id_idx').on(t.redirectId),
  ]
);

// ============ Extension end-user events (one row per serve / request; distinct from Better Auth `user`) ============
export const enduserEventTypeEnum = pgEnum('enduser_event_type', [
  'ad',
  'notification',
  'popup',
  'request',
  'redirect',
  'visit',
]);
export const enduserPlanEnum = pgEnum('enduser_user_plan', ['trial', 'paid']);
export const enduserStatusEnum = pgEnum('enduser_status', ['active', 'suspended', 'churned']);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'completed',
  'failed',
  'refunded',
]);

/** Extension customers (distinct from Better Auth `user`). Anonymous rows use installationId + shortId; email/password optional until registration. */
export const endUsers = pgTable('end_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  /** Stable id from extension chrome.storage (first install). */
  installationId: varchar('installation_id', { length: 255 }).unique(),
  /** Human-readable id for dashboard and support. */
  shortId: varchar('short_id', { length: 12 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  plan: enduserPlanEnum('plan').notNull().default('trial'),
  status: enduserStatusEnum('status').notNull().default('active'),
  country: varchar('country', { length: 2 }),
  /** Account / access window start (replaces trial_started_at). */
  startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
  /** Access end; set by admin (e.g. via payment). Nullable = open-ended. */
  endDate: timestamp('end_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const enduserSessions = pgTable(
  'enduser_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endUserId: uuid('end_user_id')
      .notNull()
      .references(() => endUsers.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 255 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_enduser_sessions_end_user_id').on(t.endUserId)]
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endUserId: uuid('end_user_id')
      .notNull()
      .references(() => endUsers.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    status: paymentStatusEnum('status').notNull().default('completed'),
    description: text('description'),
    paymentDate: timestamp('payment_date', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_payments_end_user_id').on(t.endUserId)]
);

export const enduserEvents = pgTable(
  'enduser_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endUserId: varchar('enduser_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    plan: enduserPlanEnum('plan').notNull().default('trial'),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    domain: varchar('domain', { length: 255 }),
    type: enduserEventTypeEnum('type').notNull(),
    country: varchar('country', { length: 2 }),
    statusCode: integer('status_code'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('enduser_events_enduser_id_idx').on(t.endUserId),
    index('enduser_events_email_idx').on(t.email),
    index('enduser_events_campaign_id_idx').on(t.campaignId),
    index('enduser_events_type_idx').on(t.type),
    index('enduser_events_created_at_idx').on(t.createdAt),
    index('enduser_events_enduser_created_idx').on(t.endUserId, t.createdAt),
    index('enduser_events_email_created_idx').on(t.email, t.createdAt),
    index('enduser_events_campaign_created_idx').on(t.campaignId, t.createdAt),
    index('enduser_events_enduser_campaign_idx').on(t.endUserId, t.campaignId),
  ]
);

// ============ Types ============
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type Platform = typeof platforms.$inferSelect;
export type NewPlatform = typeof platforms.$inferInsert;
export type Ad = typeof ads.$inferSelect;
export type NewAd = typeof ads.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type EnduserEvent = typeof enduserEvents.$inferSelect;
export type NewEnduserEvent = typeof enduserEvents.$inferInsert;
export type EndUserRow = typeof endUsers.$inferSelect;
export type NewEndUserRow = typeof endUsers.$inferInsert;
export type EnduserSessionRow = typeof enduserSessions.$inferSelect;
export type NewEnduserSessionRow = typeof enduserSessions.$inferInsert;
export type PaymentRow = typeof payments.$inferSelect;
export type NewPaymentRow = typeof payments.$inferInsert;
