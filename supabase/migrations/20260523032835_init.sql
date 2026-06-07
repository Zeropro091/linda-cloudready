-- Create articles table
create table public.articles (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subtitle text,
  excerpt text,
  author text not null,
  role text,
  date text not null,
  time text,
  category text,
  "imageUrl" text,
  "contentArr" text[],
  "contentStr" text,
  status text not null default 'published' check (status in ('published', 'archived')),
  "createdAt" timestamp with time zone default now(),
  "updatedAt" timestamp with time zone default now()
);

-- Create gallery table
create table public.gallery (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  url text not null,
  "uploadedAt" timestamp with time zone default now()
);

-- Create profiles table for RBAC
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role text default 'user' check (role in ('admin', 'dev', 'poster', 'user')),
  quota integer default 5, -- Default quota of 5 articles/actions
  "createdAt" timestamp with time zone default now()
);

-- Enable RLS
alter table public.articles enable row level security;
alter table public.gallery enable row level security;
alter table public.profiles enable row level security;

-- Helper function to check if user is admin
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

-- Policies for articles
create policy "Allow public read access to articles"
  on public.articles for select
  using (true);

create policy "Allow admin to insert articles"
  on public.articles for insert
  with check (public.is_admin());

create policy "Allow admin to update articles"
  on public.articles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Allow admin to delete articles"
  on public.articles for delete
  using (public.is_admin());

-- Policies for gallery
create policy "Allow public read access to gallery"
  on public.gallery for select
  using (true);

create policy "Allow admin to insert gallery"
  on public.gallery for insert
  with check (public.is_admin());

create policy "Allow admin to update gallery"
  on public.gallery for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Allow admin to delete gallery"
  on public.gallery for delete
  using (public.is_admin());

-- Policies for profiles
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admin can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admin can update all profiles"
  on public.profiles for update
  using (public.is_admin());

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, quota)
  values (
    new.id, 
    new.email, 
    case when new.email = 'admin@admin.com' then 'admin'
         when new.email = 'dev@dev.com' then 'dev'
         else 'user' end,
    case when new.email in ('admin@admin.com', 'dev@dev.com') then 999 else 5 end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
