-- Soft-delete: add `deleted` to campaign_status (row kept; events keep campaign_id)
DO $$ BEGIN
  ALTER TYPE "campaign_status" ADD VALUE 'deleted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
