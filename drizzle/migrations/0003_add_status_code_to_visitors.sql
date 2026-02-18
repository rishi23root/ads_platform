-- Add status_code to visitors (HTTP status we responded with)
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "status_code" integer;
