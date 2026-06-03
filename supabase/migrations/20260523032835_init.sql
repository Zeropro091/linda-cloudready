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

-- Enable RLS
alter table public.articles enable row level security;
alter table public.gallery enable row level security;

-- Policies for articles
create policy "Allow public read access to articles"
  on public.articles for select
  using (true);

create policy "Allow anonymous/all insert to articles"
  on public.articles for insert
  with check (true);

create policy "Allow anonymous/all update to articles"
  on public.articles for update
  using (true)
  with check (true);

create policy "Allow anonymous/all delete to articles"
  on public.articles for delete
  using (true);

-- Policies for gallery
create policy "Allow public read access to gallery"
  on public.gallery for select
  using (true);

create policy "Allow anonymous/all insert to gallery"
  on public.gallery for insert
  with check (true);

create policy "Allow anonymous/all update to gallery"
  on public.gallery for update
  using (true)
  with check (true);

create policy "Allow anonymous/all delete to gallery"
  on public.gallery for delete
  using (true);
