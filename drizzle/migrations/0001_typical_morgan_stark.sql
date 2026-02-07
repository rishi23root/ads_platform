DO $$ BEGIN
  ALTER TABLE "notifications" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;