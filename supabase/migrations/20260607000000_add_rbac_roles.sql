-- Remove old check constraint and set new one
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'dev', 'poster', 'user'));
alter table public.profiles alter column role set default 'user';

-- Add author_id to articles if not exists
alter table public.articles add column if not exists author_id uuid references public.profiles(id) on delete set null;

-- Helper functions for policies
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_dev()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'dev'
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_admin_or_dev()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'dev')
  );
end;
$$ language plpgsql security definer;

-- Drop old policies on profiles and recreate
drop policy if exists "Admin can view all profiles" on public.profiles;
drop policy if exists "Admin can update all profiles" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admin and Dev can view all profiles"
  on public.profiles for select
  using (public.is_admin_or_dev());

create policy "Admin and Dev can update all profiles"
  on public.profiles for update
  using (public.is_admin_or_dev());

-- Drop old policies on articles and recreate
drop policy if exists "Allow admin to insert articles" on public.articles;
drop policy if exists "Allow admin to update articles" on public.articles;
drop policy if exists "Allow admin to delete articles" on public.articles;
drop policy if exists "Allow public read access to articles" on public.articles;

create policy "Allow public read access to articles"
  on public.articles for select
  using (true);

create policy "Allow authenticated users to insert articles"
  on public.articles for insert
  with check (
    auth.uid() is not null and (
      public.is_admin_or_dev() or 
      exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'poster' and quota > 0
      )
    )
  );

create policy "Allow admin, dev, or author to update articles"
  on public.articles for update
  using (
    public.is_admin_or_dev() or 
    (author_id = auth.uid() and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'poster'
    ))
  );

create policy "Allow admin, dev, or author to delete articles"
  on public.articles for delete
  using (
    public.is_admin_or_dev() or 
    (author_id = auth.uid() and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'poster'
    ))
  );

-- Drop old policies on gallery and recreate
drop policy if exists "Allow admin to insert gallery" on public.gallery;
drop policy if exists "Allow admin to update gallery" on public.gallery;
drop policy if exists "Allow admin to delete gallery" on public.gallery;
drop policy if exists "Allow public read access to gallery" on public.gallery;

create policy "Allow public read access to gallery"
  on public.gallery for select
  using (true);

create policy "Allow authenticated users to insert gallery"
  on public.gallery for insert
  with check (
    auth.uid() is not null and (
      public.is_admin_or_dev() or 
      exists (select 1 from public.profiles where id = auth.uid() and role = 'poster')
    )
  );

create policy "Allow admin, dev, or author to delete gallery"
  on public.gallery for delete
  using (
    public.is_admin_or_dev()
  );

-- Update handle_new_user() function
create or replace function public.handle_new_user()
returns trigger as $$
declare
  signup_role text;
begin
  -- Get role from metadata, default to 'user'
  signup_role := coalesce(new.raw_user_meta_data->>'role', 'user');

  -- Enforce specific emails
  if new.email = 'admin@admin.com' then
    signup_role := 'admin';
  elsif new.email = 'dev@dev.com' then
    signup_role := 'dev';
  end if;

  insert into public.profiles (id, email, role, quota)
  values (
    new.id, 
    new.email, 
    signup_role,
    case 
      when signup_role in ('admin', 'dev') then 999 
      else 5 
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger/function to manage quotas and assign author_id
create or replace function public.manage_article_quota()
returns trigger as $$
declare
  u_id uuid;
  u_role text;
  u_quota integer;
begin
  u_id := auth.uid();
  if u_id is not null then
    -- Get user info
    select role, quota into u_role, u_quota
    from public.profiles
    where id = u_id;

    -- Check and decrement quota for posters
    if u_role = 'poster' then
      if u_quota is null or u_quota <= 0 then
        raise exception 'Insufficient article quota. Please request more quota from an administrator.';
      end if;
      
      update public.profiles
      set quota = quota - 1
      where id = u_id;
    end if;

    -- Automatically associate the article with the current user
    new.author_id := u_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_article_inserted on public.articles;
create trigger on_article_inserted
  before insert on public.articles
  for each row execute procedure public.manage_article_quota();

-- Validate profile updates (Admin vs Dev capabilities)
create or replace function public.validate_profile_update()
returns trigger as $$
declare
  updater_role text;
begin
  updater_role := (select role from public.profiles where id = auth.uid());

  -- If not admin or dev, reject
  if updater_role not in ('admin', 'dev') then
    raise exception 'Unauthorized to update profiles.';
  end if;

  -- Admin cannot modify Dev profile, promote to Admin, or promote to Dev
  if updater_role = 'admin' then
    if (new.role in ('admin', 'dev') and old.role not in ('admin', 'dev')) then
      raise exception 'Only developers can promote users to Admin or Developer.';
    end if;
    if old.role = 'dev' then
      raise exception 'Administrators cannot modify Developer profiles.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_update on public.profiles;
create trigger on_profile_update
  before update on public.profiles
  for each row execute procedure public.validate_profile_update();
