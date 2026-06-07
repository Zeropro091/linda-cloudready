-- Add writer identity fields to profiles table
alter table public.profiles
  add column if not exists full_name    text,
  add column if not exists pen_name     text,
  add column if not exists bio          text,
  add column if not exists profile_photo text,
  add column if not exists phone_number text,
  add column if not exists city         text;

-- Backfill full_name from auth.users metadata for existing users
update public.profiles p
set full_name = coalesce(
  (select raw_user_meta_data->>'full_name' from auth.users u where u.id = p.id),
  split_part(p.email, '@', 1)
)
where p.full_name is null;

-- Update handle_new_user trigger to capture identity fields from metadata
create or replace function public.handle_new_user()
returns trigger as $$
declare
  signup_role text;
begin
  -- Get role from metadata, default to 'user'
  signup_role := coalesce(new.raw_user_meta_data->>'role', 'user');

  -- Enforce specific emails override role
  if new.email = 'admin@admin.com' then
    signup_role := 'admin';
  elsif new.email = 'dev@dev.com' then
    signup_role := 'dev';
  end if;

  insert into public.profiles (id, email, role, quota, full_name, pen_name, bio, profile_photo, phone_number, city)
  values (
    new.id,
    new.email,
    signup_role,
    case
      when signup_role in ('admin', 'dev') then 999
      else 5
    end,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(coalesce(new.raw_user_meta_data->>'pen_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'bio', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'profile_photo', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone_number', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'city', '')), '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Update validate_profile_update trigger to allow users to update their own profile
-- (needed for the writer application flow)
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS trigger AS $$
DECLARE
  updater_role text;
BEGIN
  updater_role := (SELECT role FROM public.profiles WHERE id = auth.uid());

  -- Users can update their own profile (e.g. writer application)
  IF auth.uid() = OLD.id THEN
    IF NEW.role NOT IN ('user', 'poster') AND updater_role NOT IN ('admin', 'dev') THEN
      RAISE EXCEPTION 'You can only apply for the poster role.';
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

-- Fix manage_article_quota trigger to avoid statement timeout
-- The old version called auth.uid() inside SECURITY DEFINER which deadlocks
-- in local Supabase. Use NEW.author_id (set by client) instead.
CREATE OR REPLACE FUNCTION public.manage_article_quota()
RETURNS trigger AS $$
DECLARE
  u_role text;
  u_quota integer;
BEGIN
  IF NEW.author_id IS NULL THEN
    NEW.author_id := auth.uid();
  END IF;

  IF NEW.author_id IS NOT NULL THEN
    SELECT role, quota
      INTO u_role, u_quota
      FROM public.profiles
     WHERE id = NEW.author_id;

    IF u_role = 'poster' THEN
      IF u_quota IS NULL OR u_quota <= 0 THEN
        RAISE EXCEPTION 'Insufficient article quota. Please request more quota from an administrator.';
      END IF;
      UPDATE public.profiles SET quota = quota - 1 WHERE id = NEW.author_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
