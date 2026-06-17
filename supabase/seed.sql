-- Create an admin user if it doesn't exist
-- Password is '123123'
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, aud, role)
SELECT 
    '00000000-0000-0000-0000-000000000001', 
    '00000000-0000-0000-0000-000000000000', 
    'admin@admin.com', 
    crypt('123123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"Admin"}', 
    now(), 
    now(), 
    '', '', '', '', 'authenticated', 'authenticated'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@admin.com');

-- Ensure the profile is admin
INSERT INTO public.profiles (id, email, role, quota)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@admin.com', 'admin', 999)
ON CONFLICT (id) DO UPDATE SET role = 'admin', quota = 999;

-- Create a dev user if it doesn't exist
-- Password is '123123'
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, aud, role)
SELECT 
    '00000000-0000-0000-0000-000000000002', 
    '00000000-0000-0000-0000-000000000000', 
    'dev@dev.com', 
    crypt('123123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"Dev User"}', 
    now(), 
    now(), 
    '', '', '', '', 'authenticated', 'authenticated'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dev@dev.com');

-- Ensure the profile is dev
INSERT INTO public.profiles (id, email, role, quota)
VALUES ('00000000-0000-0000-0000-000000000002', 'dev@dev.com', 'dev', 999)
ON CONFLICT (id) DO UPDATE SET role = 'dev', quota = 999;

-- Create a poster/journalist user if it doesn't exist
-- Password is '123123'
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, aud, role)
SELECT 
    '00000000-0000-0000-0000-000000000003', 
    '00000000-0000-0000-0000-000000000000', 
    'poster@poster.com', 
    crypt('123123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"Poster User"}', 
    now(), 
    now(), 
    '', '', '', '', 'authenticated', 'authenticated'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'poster@poster.com');

-- Ensure the profile is poster
INSERT INTO public.profiles (id, email, role, quota)
VALUES ('00000000-0000-0000-0000-000000000003', 'poster@poster.com', 'poster', 5)
ON CONFLICT (id) DO UPDATE SET role = 'poster', quota = 5;

-- Create a regular user if it doesn't exist
-- Password is '123123'
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, aud, role)
SELECT 
    '00000000-0000-0000-0000-000000000004', 
    '00000000-0000-0000-0000-000000000000', 
    'user@user.com', 
    crypt('123123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"Regular User"}', 
    now(), 
    now(), 
    '', '', '', '', 'authenticated', 'authenticated'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user@user.com');

-- Ensure the profile is user
INSERT INTO public.profiles (id, email, role, quota)
VALUES ('00000000-0000-0000-0000-000000000004', 'user@user.com', 'user', 5)
ON CONFLICT (id) DO UPDATE SET role = 'user', quota = 5;

-- Seed categories with fixed UUIDs
INSERT INTO public.categories (id, slug, name, level, sort_order) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'business', 'Business', 0, 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'world', 'World', 0, 2),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'tech', 'Tech', 0, 3),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'science', 'Science', 0, 4),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'politics', 'Politics', 0, 5),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'health', 'Health', 0, 6),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'sports', 'Sports', 0, 7),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'arts', 'Arts', 0, 8),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'opinion', 'Opinion', 0, 9)
ON CONFLICT (id) DO NOTHING;

-- Seed a default author
INSERT INTO public.authors (id, slug, name, bio)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'editorial-team', 'Editorial Team', 'Lensa Insignia editorial staff.')
ON CONFLICT (id) DO NOTHING;

-- Seed articles table
insert into public.articles (id, title, subtitle, excerpt, author, role, date, time, category, "imageUrl", "contentArr", "contentStr", status, slug, category_id, author_id, published_at) values
(
  'featured-1',
  'Global Markets Rally as Tech Sector Shows Unexpected Resilience',
  'Despite early quarter concerns, major technology firms report record-breaking earnings, driving indices to all-time highs and easing recession fears.',
  'Despite early quarter concerns, major technology firms report record-breaking earnings, driving indices to all-time highs and easing recession fears.',
  'Sarah Jenkins',
  'Senior Financial Correspondent',
  'April 14, 2026',
  '2 hours ago',
  'Business',
  'https://picsum.photos/seed/markets/1200/800',
  array[
    'The global financial markets experienced an unprecedented surge today, driven largely by a tech sector that refused to bow to early-quarter pessimism. Major indices across North America, Europe, and Asia closed at record highs, painting a picture of a global economy that is far more resilient than analysts predicted just months ago.',
    'At the heart of this rally are the quarterly earnings reports from the ''Big Tech'' conglomerates. Defying expectations of a slowdown due to regulatory pressures and supply chain bottlenecks, these companies posted record-breaking revenues. The surge was led by unexpected growth in cloud computing divisions and enterprise AI solutions, which saw adoption rates double compared to the previous fiscal year.',
    '"What we''re seeing is a fundamental shift in how businesses are investing in technology," explained Dr. Aris Thorne, Chief Economist at Global Horizon Bank. "It''s no longer about expansion; it''s about efficiency. The tools these tech giants are providing are becoming indispensable for companies trying to navigate a complex global market."',
    'The ripple effect of this tech rally was felt across other sectors. Consumer discretionary stocks saw a modest bump, while industrials held steady. However, the bond market saw a slight dip as investors moved capital into equities, chasing the higher yields promised by the tech sector''s performance.',
    'Despite the overwhelming optimism, some analysts are urging caution. The rapid ascent of these stocks has raised concerns about overvaluation. "We are in uncharted territory," warned Elena Rostova, a market strategist. "While the fundamentals are strong, the speed of this rally leaves little room for error. Any negative news, whether geopolitical or economic, could trigger a sharp correction."',
    'For now, however, the bulls are firmly in control. As the trading day closed, the atmosphere on the trading floors was one of cautious jubilation. The tech sector has once again proven its ability to drive the broader market, leaving investors eagerly anticipating the next wave of innovation and growth.'
  ],
  null,
  'published',
  'featured-1',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
),
(
  'sec-1',
  'New Climate Accord Reached in Geneva Summit',
  'World leaders agree on aggressive new carbon reduction targets for 2035.',
  'World leaders agree on aggressive new carbon reduction targets for 2035.',
  'David Chen',
  'Environmental Editor',
  'April 14, 2026',
  '4 hours ago',
  'World',
  'https://picsum.photos/seed/climate/600/400',
  array[
    'New Climate Accord Reached in Geneva Summit marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.',
    '"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.',
    'Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.',
    'As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.'
  ],
  null,
  'published',
  'sec-1',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
),
(
  'sec-2',
  'Central Bank Signals Potential Rate Cuts by Q3',
  'Inflation cools faster than expected, prompting a shift in monetary policy.',
  'Inflation cools faster than expected, prompting a shift in monetary policy.',
  'Michael Ross',
  'Economics Reporter',
  'April 14, 2026',
  '5 hours ago',
  'Business',
  'https://picsum.photos/seed/bank/600/400',
  array[
    'Central Bank Signals Potential Rate Cuts by Q3 marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.',
    '"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.',
    'Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.',
    'As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.'
  ],
  null,
  'published',
  'sec-2',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
),
(
  'sec-3',
  'Breakthrough in Quantum Computing Architecture',
  'Researchers achieve stable qubits at room temperature, a holy grail for computing.',
  'Researchers achieve stable qubits at room temperature, a holy grail for computing.',
  'Dr. Elena Rostova',
  'Science Contributor',
  'April 14, 2026',
  '6 hours ago',
  'Tech',
  'https://picsum.photos/seed/quantum/600/400',
  array[
    'Breakthrough in Quantum Computing Architecture marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.',
    '"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.',
    'Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.',
    'As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.'
  ],
  null,
  'published',
  'sec-3',
  'aaaaaaaa-0000-0000-0000-000000000003',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
),
(
  'sec-4',
  'Urban Planning Shift: The Rise of 15-Minute Cities',
  'How metropolises are redesigning themselves for hyper-local living.',
  'How metropolises are redesigning themselves for hyper-local living.',
  'James Wilson',
  'Urban Affairs',
  'April 14, 2026',
  '8 hours ago',
  'Science',
  'https://picsum.photos/seed/city/600/400',
  array[
    'Urban Planning Shift: The Rise of 15-Minute Cities marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.',
    '"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.',
    'Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.',
    'As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.'
  ],
  null,
  'published',
  'sec-4',
  'aaaaaaaa-0000-0000-0000-000000000004',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
),
(
  'trend-1',
  'Elections 2026: Key Battleground States Shift',
  'Recent polling shows unexpected demographic realignments.',
  'Recent polling shows unexpected demographic realignments.',
  'Amanda Pierce',
  'Political Analyst',
  'April 13, 2026',
  '12 hours ago',
  'Politics',
  'https://picsum.photos/seed/vote/600/400',
  array[
    'Elections 2026: Key Battleground States Shift marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.',
    '"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.',
    'Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.',
    'As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.'
  ],
  null,
  'published',
  'trend-1',
  'aaaaaaaa-0000-0000-0000-000000000005',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
),
(
  'trend-2',
  'The Future of Remote Work: Post-Pandemic Reality',
  'Companies settle into permanent hybrid models as office leases expire.',
  'Companies settle into permanent hybrid models as office leases expire.',
  'Marcus Johnson',
  'Workplace Reporter',
  'April 13, 2026',
  '14 hours ago',
  'Business',
  'https://picsum.photos/seed/office/600/400',
  array[
    'The Future of Remote Work: Post-Pandemic Reality marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.',
    '"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.',
    'Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.',
    'As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.'
  ],
  null,
  'published',
  'trend-2',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
),
(
  'trend-3',
  'Electric Vehicle Sales Surpass Traditional Autos in Europe',
  'A historic milestone for the automotive industry.',
  'A historic milestone for the automotive industry.',
  'Sophie Laurent',
  'European Correspondent',
  'April 13, 2026',
  '16 hours ago',
  'Tech',
  'https://picsum.photos/seed/ev/600/400',
  array[
    'Electric Vehicle Sales Surpass Traditional Autos in Europe marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.',
    '"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.',
    'Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.',
    'As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.'
  ],
  null,
  'published',
  'trend-3',
  'aaaaaaaa-0000-0000-0000-000000000003',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
),
(
  'trend-4',
  'Healthcare Reform Bill Passes Senate with Narrow Margin',
  'Sweeping changes to prescription drug pricing approved.',
  'Sweeping changes to prescription drug pricing approved.',
  'Thomas Wright',
  'Capitol Hill Reporter',
  'April 13, 2026',
  '18 hours ago',
  'Health',
  'https://picsum.photos/seed/health/600/400',
  array[
    'Healthcare Reform Bill Passes Senate with Narrow Margin marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.',
    '"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.',
    'Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.',
    'As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.'
  ],
  null,
  'published',
  'trend-4',
  'aaaaaaaa-0000-0000-0000-000000000006',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
),
(
  'trend-5',
  'Space Tourism: First Commercial Flight Scheduled for Next Month',
  'Civilian passengers prepare for suborbital journey.',
  'Civilian passengers prepare for suborbital journey.',
  'Dr. Elena Rostova',
  'Science Contributor',
  'April 12, 2026',
  '1 day ago',
  'Science',
  'https://picsum.photos/seed/space/600/400',
  array[
    'Space Tourism: First Commercial Flight Scheduled for Next Month marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.',
    '"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.',
    'Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.',
    'As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.'
  ],
  null,
  'published',
  'trend-5',
  'aaaaaaaa-0000-0000-0000-000000000004',
  'bbbbbbbb-0000-0000-0000-000000000001',
  now()
)
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  excerpt = excluded.excerpt,
  author = excluded.author,
  role = excluded.role,
  date = excluded.date,
  time = excluded.time,
  category = excluded.category,
  "imageUrl" = excluded."imageUrl",
  "contentArr" = excluded."contentArr",
  "contentStr" = excluded."contentStr",
  status = excluded.status,
  slug = excluded.slug,
  category_id = excluded.category_id,
  author_id = excluded.author_id,
  published_at = excluded.published_at;
