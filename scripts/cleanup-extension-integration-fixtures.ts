#!/usr/bin/env npx tsx
/**
 * Clears extension telemetry and removes Vitest / integration-test fixtures from the database.
 *
 * - Deletes all rows in `enduser_events`
 * - Deletes campaigns whose name starts with `vitest` (case-insensitive), then drops related
 *   ads, notifications, and redirects only when no remaining campaign references them
 * - Deletes platforms whose domain contains `vitest` (case-insensitive)
 * - Deletes Better Auth users used as Vitest creators (`vitest.creator%@example.test`, id `vitest-creator%`)
 * - Deletes shared extension integration end_users (`extension.shared.*@example.test`)
 *
 * Run: `pnpm db:cleanup:extension-tests`
 * Requires `DATABASE_URL` in `.env.local`.
 */
import dotenv from 'dotenv';
import postgres from 'postgres';
import { EXTENSION_SHARED_USER_EMAILS } from '../tests/support/extension-shared-fixture-emails';

dotenv.config({ path: '.env.local' });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set. Use .env.local or set the env var.');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });

  try {
    await sql.begin(async (tx) => {
      await tx`DELETE FROM enduser_events`;

      const campaignRows = await tx`
        SELECT ad_id, notification_id, redirect_id
        FROM campaigns
        WHERE lower(name) LIKE 'vitest%'
      `;

      await tx`
        DELETE FROM campaigns
        WHERE lower(name) LIKE 'vitest%'
      `;

      const adIds = [...new Set(campaignRows.map((r) => r.ad_id).filter(Boolean))] as string[];
      const notifIds = [...new Set(campaignRows.map((r) => r.notification_id).filter(Boolean))] as string[];
      const redirIds = [...new Set(campaignRows.map((r) => r.redirect_id).filter(Boolean))] as string[];

      if (adIds.length) {
        await tx`
          DELETE FROM ads
          WHERE id IN ${tx(adIds)}
          AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.ad_id = ads.id)
        `;
      }
      if (notifIds.length) {
        await tx`
          DELETE FROM notifications
          WHERE id IN ${tx(notifIds)}
          AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.notification_id = notifications.id)
        `;
      }
      if (redirIds.length) {
        await tx`
          DELETE FROM redirects
          WHERE id IN ${tx(redirIds)}
          AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.redirect_id = redirects.id)
        `;
      }

      await tx`
        DELETE FROM platforms
        WHERE lower(domain) LIKE '%vitest%'
      `;

      await tx`
        DELETE FROM "user"
        WHERE email ILIKE 'vitest.creator%@example.test'
           OR id LIKE 'vitest-creator%'
      `;

      await tx`
        DELETE FROM end_users
        WHERE email IN ${tx([...EXTENSION_SHARED_USER_EMAILS])}
      `;
    });

    console.log(
      'Done: enduser_events emptied; Vitest campaigns, matching platforms, creator users, and shared extension end_users removed.'
    );
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
