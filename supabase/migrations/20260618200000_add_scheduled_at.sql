-- Add scheduled_at column for article scheduling
ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Index for efficient scheduled article lookups
CREATE INDEX IF NOT EXISTS idx_articles_scheduled
  ON articles (scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- Update status check constraint to allow 'scheduled'
-- First drop the old constraint if it exists, then re-create
DO $$
BEGIN
  -- Drop existing check if any
  ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
  -- Add new constraint including 'scheduled'
  ALTER TABLE articles ADD CONSTRAINT articles_status_check
    CHECK (status IN ('draft', 'published', 'archived', 'scheduled'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update status constraint: %', SQLERRM;
END $$;
