/**
 * Adwarden MVP - Single schema file
 * Campaign-centric: 1 ad OR 1 notification per campaign, platforms on campaigns only
 */
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
  primaryKey,
  unique,
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
  isActive: boolean('is_active').notNull().default(true),
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

export const notificationReads = pgTable(
  'notification_reads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    visitorId: varchar('visitor_id', { length: 255 }).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.notificationId, t.visitorId)]
);

// ============ Campaigns ============
export const campaignTypeEnum = pgEnum('campaign_type', ['ads', 'popup', 'notification']);
export const frequencyTypeEnum = pgEnum('frequency_type', [
  'full_day',
  'time_based',
  'only_once',
  'always',
  'specific_count',
]);
export const targetAudienceEnum = pgEnum('target_audience', ['new_users', 'all_users']);
export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'inactive', 'scheduled', 'expired']);

export const campaigns = pgTable('campaigns', {
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
  createdBy: varchar('created_by', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const campaignPlatforms = pgTable(
  'campaign_platforms',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.platformId] })]
);

export const campaignCountries = pgTable(
  'campaign_countries',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    countryCode: varchar('country_code', { length: 2 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.countryCode] })]
);

// 1:1 - one ad per campaign (for type ads or popup)
export const campaignAd = pgTable('campaign_ad', {
  campaignId: uuid('campaign_id')
    .primaryKey()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  adId: uuid('ad_id')
    .notNull()
    .unique()
    .references(() => ads.id, { onDelete: 'cascade' }),
});

// 1:1 - one notification per campaign
export const campaignNotification = pgTable('campaign_notification', {
  campaignId: uuid('campaign_id')
    .primaryKey()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  notificationId: uuid('notification_id')
    .notNull()
    .unique()
    .references(() => notifications.id, { onDelete: 'cascade' }),
});

export const campaignVisitorViews = pgTable(
  'campaign_visitor_views',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    visitorId: varchar('visitor_id', { length: 255 }).notNull(),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.visitorId] })]
);

// ============ Visitors ============
export const visitors = pgTable('visitors', {
  visitorId: varchar('visitor_id', { length: 255 }).primaryKey(),
  country: varchar('country', { length: 2 }),
  totalRequests: integer('total_requests').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Request Logs (generic API request analytics) ============
export const requestLogTypeEnum = pgEnum('request_log_type', ['ad', 'notification', 'popup']);

export const requestLogs = pgTable('request_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  visitorId: varchar('visitor_id', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  requestType: requestLogTypeEnum('request_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Campaign Logs ============
export const campaignLogTypeEnum = pgEnum('campaign_log_type', ['ad', 'notification', 'popup']);

export const campaignLogs = pgTable('campaign_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  visitorId: varchar('visitor_id', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  country: varchar('country', { length: 2 }),
  type: campaignLogTypeEnum('type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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
export type NotificationRead = typeof notificationReads.$inferSelect;
export type NewNotificationRead = typeof notificationReads.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignPlatform = typeof campaignPlatforms.$inferSelect;
export type NewCampaignPlatform = typeof campaignPlatforms.$inferInsert;
export type CampaignCountry = typeof campaignCountries.$inferSelect;
export type NewCampaignCountry = typeof campaignCountries.$inferInsert;
export type CampaignAd = typeof campaignAd.$inferSelect;
export type NewCampaignAd = typeof campaignAd.$inferInsert;
export type CampaignNotification = typeof campaignNotification.$inferSelect;
export type NewCampaignNotification = typeof campaignNotification.$inferInsert;
export type CampaignVisitorView = typeof campaignVisitorViews.$inferSelect;
export type NewCampaignVisitorView = typeof campaignVisitorViews.$inferInsert;
export type Visitor = typeof visitors.$inferSelect;
export type NewVisitor = typeof visitors.$inferInsert;
export type RequestLog = typeof requestLogs.$inferSelect;
export type NewRequestLog = typeof requestLogs.$inferInsert;
export type CampaignLog = typeof campaignLogs.$inferSelect;
export type NewCampaignLog = typeof campaignLogs.$inferInsert;
