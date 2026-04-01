import 'server-only';

import { sql } from 'drizzle-orm';
import { campaigns } from '@/db/schema';

/**
 * Use in WHERE clauses to hide soft-deleted campaigns.
 * Compares `status::text` so databases that have not yet run
 * `0003_campaign_status_deleted.sql` (enum label missing) still evaluate this
 * filter without error.
 */
export const campaignRowNotSoftDeleted = sql`${campaigns.status}::text <> 'deleted'`;
