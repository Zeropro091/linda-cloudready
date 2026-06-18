-- StockFinder AI: API Keys & Usage Tracking
-- Migration for Supabase (PostgreSQL)

-- ═══════════════════════════════════════════════════════════
-- 1. API Keys Table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stockfinder_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,           -- SHA-256 hash of the actual API key
  key_prefix TEXT NOT NULL,                -- First 8 chars for admin display (sf_xxxx...)
  label TEXT DEFAULT '',                   -- Human-readable label ("John Doe - Writer")
  is_active BOOLEAN DEFAULT true,          -- Admin can toggle on/off
  daily_limit INTEGER DEFAULT 20,          -- Max analyses per calendar day
  total_uses INTEGER DEFAULT 0,            -- Lifetime usage counter
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,                  -- Optional expiry date (NULL = never expires)
  last_used_at TIMESTAMPTZ                 -- Last successful analysis timestamp
);

-- ═══════════════════════════════════════════════════════════
-- 2. Usage Logs Table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stockfinder_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES stockfinder_api_keys(id) ON DELETE CASCADE,
  url_analyzed TEXT NOT NULL,
  article_title TEXT DEFAULT '',
  concepts_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for daily usage counting
CREATE INDEX IF NOT EXISTS idx_usage_logs_key_date
  ON stockfinder_usage_logs (key_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- 3. Row Level Security
-- ═══════════════════════════════════════════════════════════
ALTER TABLE stockfinder_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE stockfinder_usage_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access for keys (via service role or anon key with admin check)
CREATE POLICY "Allow all for service role" ON stockfinder_api_keys
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON stockfinder_usage_logs
  FOR ALL USING (true) WITH CHECK (true);
