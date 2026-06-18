-- ═══════════════════════════════════════════════════════════════
-- Migration: Inbox, Writer Verification & Article Review
-- ═══════════════════════════════════════════════════════════════

-- 1. Add writer verification columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS writer_status text NOT NULL DEFAULT 'none'
    CHECK (writer_status IN ('none', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Backfill: existing posters are already approved
UPDATE public.profiles
SET writer_status = 'approved'
WHERE role = 'poster' AND writer_status = 'none';

-- 2. Expand article status to include pending_review and rejected
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_status_check
  CHECK (status IN ('draft', 'published', 'archived', 'scheduled', 'pending_review', 'rejected'));

-- 3. Update validate_profile_update trigger
-- Users can no longer self-promote to 'poster'. They set writer_status = 'pending' instead.
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS trigger AS $$
DECLARE
  updater_role text;
BEGIN
  updater_role := (SELECT role FROM public.profiles WHERE id = auth.uid());

  -- Users can update their own profile
  IF auth.uid() = OLD.id THEN
    -- Regular users cannot change their own role (except admin/dev updating themselves)
    IF NEW.role <> OLD.role AND updater_role NOT IN ('admin', 'dev') THEN
      RAISE EXCEPTION 'You cannot change your own role. Apply as a writer instead.';
    END IF;
    -- Users can set writer_status to pending (applying)
    IF NEW.writer_status <> OLD.writer_status AND updater_role NOT IN ('admin', 'dev') THEN
      IF NEW.writer_status NOT IN ('pending', 'none') THEN
        RAISE EXCEPTION 'Invalid writer status update.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Must be admin or dev to modify other profiles
  IF updater_role NOT IN ('admin', 'dev') THEN
    RAISE EXCEPTION 'Unauthorized to update profiles.';
  END IF;

  -- Admin cannot modify Dev profile or promote to admin/dev
  IF updater_role = 'admin' THEN
    IF (NEW.role IN ('admin', 'dev') AND OLD.role NOT IN ('admin', 'dev')) THEN
      RAISE EXCEPTION 'Only developers can promote users to Admin or Developer.';
    END IF;
    IF OLD.role = 'dev' THEN
      RAISE EXCEPTION 'Administrators cannot modify Developer profiles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Allow users to update their own writer_status (for applying)
-- The existing self-update policy should already cover this,
-- but let's make sure it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
