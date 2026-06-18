-- ═══════════════════════════════════════════════════════════════
-- Migration: Quota Request System
-- ═══════════════════════════════════════════════════════════════

-- 1. Create quota_requests table
CREATE TABLE IF NOT EXISTS public.quota_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 5 CHECK (amount > 0 AND amount <= 100),
  proof_url text, -- transfer proof image URL
  message text, -- optional message from user
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text, -- admin response/notes
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.quota_requests ENABLE ROW LEVEL SECURITY;

-- 3. Users can view their own requests
CREATE POLICY "Users can view their own quota requests"
  ON public.quota_requests FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Users can insert their own requests
CREATE POLICY "Users can create quota requests"
  ON public.quota_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Admin/Dev can view all requests
CREATE POLICY "Admin and Dev can view all quota requests"
  ON public.quota_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dev')
    )
  );

-- 6. Admin/Dev can update requests (approve/reject)
CREATE POLICY "Admin and Dev can update quota requests"
  ON public.quota_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dev')
    )
  );
