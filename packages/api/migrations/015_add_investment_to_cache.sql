-- Add investment JSONB column to insights_cache for storing computed investment score
ALTER TABLE insights_cache ADD COLUMN IF NOT EXISTS investment JSONB;
