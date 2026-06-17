# Code Review: Lensa Insignia (MediaLens)

**Date:** June 16, 2026 (Updated)  
**Scope:** Code Quality, Security, SEO Availability, SEO Structure  
**Repo:** `Zeropro091/project-medialens`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Code Quality](#2-code-quality)
3. [Security Audit](#3-security-audit)
4. [SEO Availability Audit](#4-seo-availability-audit)
5. [SEO Structure Audit](#5-seo-structure-audit)
6. [Priority Action Items](#6-priority-action-items)

---

## 1. Executive Summary

| Category | Rating | Critical Issues | Recommendations |
|---|---|---|---|
| Code Quality | 7/10 | 0 critical, 5 moderate | Improve TypeScript strictness, reduce `any` usage |
| Security | 8/10 | 0 critical, 3 moderate | Add input validation, fix failed migration |
| SEO Availability | 8/10 | 0 critical, 1 moderate | Add alt text for dropdown images, fix 404 SEO |
| SEO Structure | 8/10 | 0 critical, 2 low | Add breadcrumb schema, improve heading hierarchy |

---

## 2. Code Quality

### 2.1 TypeScript Strictness

**Rating: 6/10**

The project uses TypeScript but runs with `skipLibCheck: true` and heavy reliance on `any` types.

**Issues found:**

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `src/App.tsx` | `ARTICLES` array typed as `any[]` | Moderate |
| 2 | `src/pages/AdminDashboard.tsx` | Most state variables typed as `any[]` or `any` | Moderate |
| 3 | `src/pages/AdminDashboard.tsx` | `editingArticle` typed as `any \| null` — no Article interface enforcement | Moderate |
| 4 | `src/App.tsx` | `AdSlot` sponsors typed as `any[]` | Low |
| 5 | `src/lib/supabase.ts` | `(import.meta as any).env` — unsafe access pattern | Low |
| 6 | `src/pages/AdminDashboard.tsx` | Error handler `catch (e: any)` used throughout | Low |

**Recommendations:**

1. **Define strict Article types** — The `database.types.ts` file has a well-defined `Article` interface but it's never used. Import it and use `Article[]` instead of `any[]`.
2. **Create Supabase env type helper** — Replace `(import.meta as any).env.VITE_*` with a typed helper or use `import.meta.env` directly (Vite supports it without casting).
3. **Type Supabase responses** — Use Supabase's generated types or the `Article` interface to type query results: `supabase.from('articles').select('*')` should return typed data.
4. **Enable `strict: true`** in tsconfig.json — This catches null/undefined issues at compile time.

### 2.2 Component Architecture

**Rating: 8/10**

**Strengths:**
- Good separation of concerns: pages, components, lib, types
- React.lazy used for admin/auth pages (avoids SSR ESM circular deps)
- Custom hooks pattern via `useAuth()`, `useArticles()`
- SSR-safe patterns: `typeof window !== 'undefined'` guards, lazy client-only imports

**Issues:**

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `src/App.tsx` | Monolithic file (~1600 lines) — all pages, SEO, AdSlot, Header, Footer, StaticPage, routing in one file | Moderate |
| 2 | `src/pages/AdminDashboard.tsx` | Huge monolithic file (~900 lines) with inline AdManagementTab component | Moderate |
| 3 | `src/App.tsx` | Auth logic in both `AuthProvider.tsx` and `App.tsx` — tight coupling | Low |
| 4 | `src/pages/AdminDashboard.tsx` | Login/register UI duplicated inside admin page instead of using LoginPage/RegisterPage | Moderate |

**Recommendations:**

1. **Split `App.tsx`** — Extract Header, Footer, Sidebar, AdSlot, SEO, and StaticPage into separate component files under `src/components/`.
2. **Split `AdminDashboard.tsx`** — Extract AdManagementTab into its own file under `src/components/admin/`.
3. **Remove duplicate login UI** — AdminDashboard has its own login form that duplicates LoginPage. Redirect to /login instead.

### 2.3 Error Handling

**Rating: 7/10**

**Strengths:**
- `handleSupabaseError()` utility provides consistent error formatting
- Error boundaries via try/catch on all async operations
- Base64 fallback for storage uploads

**Issues:**

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `src/pages/AdminDashboard.tsx` | `alert()` used for user-facing errors — poor UX | Moderate |
| 2 | `src/pages/AdminDashboard.tsx` | `handleBatchGalleryUpload` uses `galleryInputRef.current?.files?.length` for upload count display, but this ref isn't updated on drop events | Low |
| 3 | `src/App.tsx` | `fetchArticles()` catches error but only logs it — user sees stale mock data silently | Low |

**Recommendations:**
1. Replace `alert()` calls with toast notifications.
2. Add a dedicated upload count state for gallery drops.
3. Surface article fetch errors to users with a retry option.

---

## 3. Security Audit

### 3.1 Supabase Row Level Security (RLS)

**Rating: 7/10**

**RLS Policy Coverage:**

| Table | RLS Enabled | Policies | Status |
|---|---|---|---|
| `articles` | ✅ | Public read, auth insert, admin/dev/poster update/delete | ✅ Good |
| `profiles` | ✅ | Self-read, admin/dev read/update, validate_profile_update trigger | ✅ Good |
| `gallery` | ✅ | Public read, auth insert, admin/dev delete | ✅ Good |
| `ad_sponsors` | ✅ | Public read active, admin/dev CRUD via `is_admin_or_dev()` | ✅ Fixed |

**Issues found:**

| # | Table | Issue | Severity | Status |
|---|---|---|---|---|
| 1 | `ad_sponsors` | Original "Sponsors dev all" policy used `auth.role() = 'service_role'` — doesn't work from client (anon key). All inserts/updates/deletes were blocked. | **High** | ✅ Fixed |
| 2 | `articles` | The CHECK constraint `articles_published_requires_fields` (added by `20260610400000_enhance_articles_table.sql`) could not be applied — existing published rows have NULL values for `slug`, `category_id`, `author_id`, `published_at`. Migration failed. | **High** | ❌ Still unresolved |
| 3 | `gallery` | Insert policy allows any authenticated user (including standard "user" role) to upload to gallery | Low | ✅ Acceptable for current scope |
| 4 | `articles` | Public read policy is `USING (true)` — everyone can read all articles including drafts (though filtered client-side) | Moderate | ❌ Still unresolved — client-side filter only |

**Recommendations:**
1. ✅ **Done** — `ad_sponsors` RLS policy fixed using `is_admin_or_dev()`.
2. ❌ **Still open** — Fix the failed migration: update existing published articles with placeholder slug values, then re-run migration `20260610400000_enhance_articles_table.sql`.
3. ❌ **Still open** — Filter drafts at DB level: add `.eq('status', 'published')` to public article queries.
4. **Restrict gallery insert** — Consider limiting gallery insert to poster/admin/dev roles.
5. **Add rate limiting** — No rate limiting on article insertion or auth endpoints (handled at Supabase project level but not enforced in policies).

### 3.2 Authentication

**Rating: 7/10**

**Strengths:**
- Supabase Auth with email/password
- `handle_new_user()` trigger enforces special roles for known admin/dev emails
- `validate_profile_update()` trigger prevents admin from promoting to dev
- Quota system for poster role
- Registration only allows self-assigning to "user" or "poster" roles

**Issues:**

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `src/App.tsx` | Hardcoded search bypass: entering "admin123123" in search navigated to /admin | **High** | ✅ Fixed — removed |
| 2 | `src/components/AuthProvider.tsx` | `loading` state initializes as `false` (not `true`) for SSR stability — means components render before session is checked | Moderate | ❌ Still unresolved |
| 3 | `src/components/AuthProvider.tsx` | `setTimeout(() => fetchProfile(...), 0)` inside `onAuthStateChange` — works but is a fragile pattern | Low | ❌ Still unresolved |

**Recommendations:**
1. ✅ **Done** — Admin search bypass removed.
2. **Add proper rate limiting** on auth endpoints (configured in Supabase project settings).
3. **Add CSRF protection** — The app uses cookies (implicit via Supabase), but there's no explicit CSRF token.

### 3.3 Input Validation & XSS

**Rating: 6/10**

**Issues:**

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `src/pages/AdminDashboard.tsx` | Image upload size validation exists (10MB) but server-side validation is missing | Moderate |
| 2 | `src/pages/AdminDashboard.tsx` | No validation on article title length before sending to DB (DB has CHAR(200) constraint but no client-side check) | Moderate |
| 3 | `src/App.tsx` | Image URLs from user input are rendered in `<img>` tags — this is safe but could be used for tracking pixels | Low |
| 4 | `src/App.tsx` | Search query is passed via URL params and rendered — React escapes it by default, so XSS risk is low | Low |

**Recommendations:**
1. Add client-side character length validation for title (max 200) and excerpt (max 300).
2. Add file-type validation server-side via Supabase Storage bucket policies.
3. Consider adding a Content Security Policy (CSP) header in server.ts.

### 3.4 Secrets Management

**Rating: 6/10**

**Issues:**

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `.env.example` | Check that no real secrets are checked into git | Low |
| 2 | `server.ts` | Uses `process.env.VITE_SUPABASE_ANON_KEY` — the anon key is public by design, so this is acceptable | Informational |
| 3 | `supabase/config.toml` | Contains `JWT_SECRET` reference via env var — ensure it's not hardcoded | Low |

### 3.5 Summary of Security Fixes Applied

| # | Issue | Resolution |
|---|---|---|
| 1 | Admin search bypass (`admin123123` → `/admin`) | Removed hardcoded backdoor in `App.tsx` |
| 2 | `ad_sponsors` RLS using `service_role` (blocked all client operations) | Replaced with `is_admin_or_dev()` — same pattern as other tables |
| 3 | `ad_sponsors` `image_url`/`target_url` NOT NULL constraint violated on save | Fixed null coalescing to send empty strings instead of `null` |
| 4 | Slow SSR page loads with no caching | In-memory 30s TTL cache + stale fallback in `entry-server.tsx` |
| 5 | Multiple AdSlot instances fire N parallel Supabase queries | Promise dedup + 30s TTL cache + stale fallback in `App.tsx` |
| 6 | All AdSlots started at index 0 — showed the same sponsor | Slot ID counter distributes starting indices via `slotIdRef % fetched.length` |
| 7 | Frequency gate used `fetched[0].frequency` for all slots | Each sponsor's own frequency used; re-evaluated on rotation |

---

## 4. SEO Availability Audit

### 4.1 Meta Tags & Helmet

**Rating: 8/10**

**Strengths:**
- `react-helmet-async` used correctly for per-page meta tags
- All major pages have unique title, description, canonical URL
- Open Graph tags for Facebook/LinkedIn sharing (site_name, title, description, type, url, image)
- Twitter Card tags with `summary_large_image`
- Fallback meta tags in `index.html` for when JS hasn't loaded
- `max-image-preview:large` and `max-snippet:-1` robots directives

**Coverage:**

| Page | Title | Description | OG Tags | Twitter | Canonical | Schema |
|---|---|---|---|---|---|---|
| Homepage | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Organization) |
| Article | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (NewsArticle) |
| Category | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Static Pages | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 404 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Login/Register | ❌ (Helmet not used) | ❌ | ❌ | ❌ | ❌ | ❌ |

**Issues:**

| # | Page | Issue | Severity |
|---|---|---|---|
| 1 | Login/Register | No Helmet meta tags — title defaults to "Lensa Insignia" with no description | Moderate |
| 2 | 404 | Helmet sets title/description but no OG or Twitter tags | Low |
| 3 | Category | No structured data (BreadcrumbList or CollectionPage schema) | Low |

**Recommendations:**
1. Add SEO component to LoginPage and RegisterPage with `noindex` robots directive.
2. Add `BreadcrumbList` structured data to CategoryPage and ArticlePage.
3. Add `WebPage` schema to static pages.

### 4.2 Structured Data (Schema.org)

**Rating: 7/10**

**Present schemas:**
- **Organization** — Homepage: `NewsMediaOrganization` with logo, founding date, URL
- **NewsArticle** — Article pages: headline, image, datePublished, dateModified, author, publisher, articleSection

**Missing schemas:**
- **BreadcrumbList** — All pages (especially articles and categories)
- **CollectionPage** — Category pages (signals to Google that this is a listing page)
- **WebPage** — Static pages (About, Careers, etc.)
- **SearchAction** — Site search box in SERP (SiteLinksSearchBox)
- **Article** — Category listing cards could use `Article` schema for each card

### 4.3 Sitemaps

**Rating: 8/10**

**Strengths:**
- Dynamic sitemap at `/sitemap.xml` with all static pages, categories, and articles
- Google News sitemap at `/news-sitemap.xml` with last 48 hours of articles
- Proper XML escaping (`xmlEscape()` function)
- Correct priority/changefreq assignments:
  - Homepage: 1.0 / hourly
  - Categories: 0.8 / daily
  - Articles: 0.9 / weekly
  - Static pages: 0.5 / monthly
- `robots.txt` disallows admin/auth pages, allows public content

**Issues:**

| # | Issue | Severity |
|---|---|---|
| 1 | Sitemap URL in robots.txt uses placeholder domain (`https://lensainsignia.com`) — must be updated for production | Low |
| 2 | No `lastmod` for static pages and categories in the sitemap | Low |
| 3 | No image sitemap for article images | Low |

### 4.4 Server-Side Rendering (SSR)

**Rating: 9/10**

**Strengths:**
- Full SSR with Express + Vite
- Article data pre-fetched server-side and injected via `window.__INITIAL_ARTICLES__`
- Hydration mismatch prevention: SSR articles seed state, client skips initial fetch
- 5-second timeout on SSR article fetch to avoid blocking
- Fallback to empty array if fetch fails
- Proper 404 status code detection for invalid routes
- `StrictMode` enabled for development warnings

**Issues:**

| # | Issue | Severity |
|---|---|---|
| 1 | SSR fetches ALL articles on every request — no caching layer. Could be slow with 1000+ articles | Moderate | ✅ Fixed — in-memory cache with 30s TTL + stale fallback |
| 2 | CategoryPage and ArticlePage both rely on SSR initial data, but only the homepage receives it. Navigation to categories/articles after hydration triggers a client-side fetch | Low | ❌ Still unresolved |

**Recommendations:**
1. ✅ **Done** — In-memory SSR cache with 30s TTL and stale fallback added to `entry-server.tsx`. Also added `AdSlot` sponsor caching with promise dedup in `App.tsx`.
2. ✅ **Done** — AdSlot slot distribution via unique slot IDs ensures different slots show different sponsors.
3. ✅ **Done** — Per-sponsor frequency gate: each sponsor controls its own visibility via its `frequency` field, re-evaluated on rotation.
2. Consider streaming SSR or prioritized loading for article detail pages.

---

## 5. SEO Structure Audit

### 5.1 URL Structure

**Rating: 8/10**

**Patterns used:**
- `/` — Homepage
- `/article/:id` — Article detail (uses database UUID/ID)
- `/category/:slug` — Category listing (slug-based: lowercase, hyphenated)
- `/about`, `/careers`, `/ethics`, `/contact`, `/newsletters` — Static pages
- `/terms`, `/privacy`, `/cookies`, `/accessibility` — Legal/Policy pages
- `/login`, `/register`, `/profile`, `/dashboard`, `/admin` — Auth/Admin

**Issues:**

| # | Issue | Severity |
|---|---|---|
| 1 | Article URLs use DB IDs (UUID/auto-increment) instead of SEO-friendly slugs | Moderate |
| 2 | Category links in article page use `/?category=X` query parameter instead of `/category/X` | Low |
| 3 | No pagination URL structure for category pages (e.g., `/category/world/page/2`) | Low |

**Recommendations:**
1. **Article slugs** — Add slug-based article URLs: `/article/:slug` instead of `/article/:id`. The `articles` table already has a `slug` column (from migration 20260610400000). Use it.
2. **Pagination** — Add page-based pagination to category listings: `/category/:slug/page/:num`.
3. **301 redirects** — When slug URLs are implemented, redirect old `/article/:id` URLs to `/article/:slug`.

### 5.2 Heading Hierarchy

**Rating: 7/10**

**Current structure:**

| Page | H1 | H2 | H3+ |
|---|---|---|---|
| Homepage | ✅ "Lensa Insignia" (logo) OR dynamic category/Search title | ✅ Article titles as H2/H3 | ✅ Sidebar "Trending Now" H3 |
| Article | ✅ Article title (H1) | ❌ No H2 for sections | ✅ "Related Articles" H3 |
| Category | ✅ Category name (H1) | ❌ Article titles should be H2 but are rendered in `<div>` / `<Link>` | ✅ |
| Static Pages | ✅ Page title (H1) | ✅ Section headers as H2 | ❌ Missing H3 subheadings |

**Issues:**

| # | Page | Issue | Severity |
|---|---|---|---|
| 1 | Homepage | Article titles in filtered grid use `<h3>` but should use `<h2>` when not the hero | Moderate |
| 2 | Category | Article cards use `<h2>` for titles ✅ (good) | — |
| 3 | Article | Article body sections (from markdown) don't have proper heading hierarchy enforced | Low |

### 5.3 Semantic HTML

**Rating: 8/10**

**Strengths:**
- `<header>` — Main header with navigation ✅
- `<nav>` — Category navigation bar ✅
- `<main>` — Content wrapper for each page ✅
- `<footer>` — Site footer with links ✅
- `<article>` — Article cards in listing pages ✅
- `<figure>` / `<figcaption>` — Article images with captions ✅
- `<aside>` — Sidebar widget area ✅
- `aria-label` — Applied to search, menu, ad slots, share buttons ✅

**Issues:**

| # | Issue | Severity |
|---|---|---|
| 1 | Category page article cards use `<article>` but aren't inside a `<section>` | Low |
| 2 | No `<hgroup>` for article header (title + subtitle) — minor semantic improvement | Low |
| 3 | No `role="banner"`, `role="navigation"`, `role="contentinfo"` landmarks (browsers infer from HTML5 elements, but explicit roles improve accessibility) | Low |

### 5.4 Performance for SEO

**Issues:**

| # | Issue | Severity |
|---|---|---|
| 1 | No lazy loading for below-fold images on article pages — though `loading="lazy"` is used on most images | ✅ Good |
| 2 | Third-party fonts (Google Fonts) loaded render-blocking — could delay FCP | Moderate |
| 3 | No preload/preconnect for critical resources (hero image) | Low |
| 4 | Large bundle size — all of AdminDashboard, MDEditor are lazy-loaded ✅ but the main App.tsx still has all components bundled | Moderate |

### 5.5 Mobile SEO

**Rating: 8/10**

**Strengths:**
- Responsive design with Tailwind CSS (mobile-first classes: `hidden md:flex`, `grid-cols-1 md:grid-cols-2`)
- Proper viewport meta tag: `width=device-width, initial-scale=1.0`
- Separate ad sizes for mobile vs desktop
- Mobile hamburger menu with slide-out navigation

**Issues:**

| # | Issue | Severity |
|---|---|---|
| 1 | No `font-display: swap` on Google Fonts to prevent invisible text during load | Moderate |
| 2 | Ad slots on mobile (320x50) could cause layout shift if they load late | Low |

---

## 6. Priority Action Items

### ✅ Recently Completed

| # | Item | Category | Effort | Fixed In |
|---|---|---|---|---|
| — | **Remove admin search bypass** ("admin123123" in search → /admin) | Security | 5 min | `src/App.tsx` |
| — | **Fix ad_sponsors RLS policy** (was using `service_role`, now uses `is_admin_or_dev()`) | Security | 30 min | Database + migration SQL |
| — | **Add server-side caching** for SSR article queries (30s TTL + stale fallback) | Performance/SEO | 30 min | `src/entry-server.tsx` |
| — | **Add AdSlot sponsor cache** with promise dedup and stale fallback | Performance | 15 min | `src/App.tsx` |
| — | **Fix sponsor null constraint** (`image_url`/`target_url` sending `null` instead of empty string) | Bug Fix | 5 min | `src/pages/AdminDashboard.tsx` |
| — | **Fix AdSlot slot distribution** — all slots started at index 0, showing the same sponsor | Ad System | 15 min | `src/App.tsx` |
| — | **Fix per-sponsor frequency gate** — used `fetched[0].frequency` for all slots instead of each sponsor's own frequency | Ad System | 15 min | `src/App.tsx` |

### 🔴 Critical (Fix ASAP)

| # | Item | Category | Effort |
|---|---|---|---|
| 1 | **Apply failed migration** — update existing articles with placeholder slugs, re-run `20260610400000_enhance_articles_table.sql` | Security/Data | 30 min |
| 2 | **Fix article filtering** — filter `status = 'published'` at DB level, not just client-side | Security | 15 min |

### 🟡 High Priority

| # | Item | Category | Effort |
|---|---|---|---|
| 3 | **Replace `any` types** with `Article` and `Sponsor` interfaces | Code Quality | 1 hr |
| 4 | **Split App.tsx** into smaller component files | Code Quality | 2 hr |
| 5 | **Add slug-based article URLs** (`/article/:slug` instead of `/article/:id`) | SEO | 3 hr |
| 6 | **Add BreadcrumbList structured data** to articles and categories | SEO | 1 hr |
| 7 | **Add login/register SEO meta** (noindex + title/description) | SEO | 15 min |

### 🟢 Medium Priority

| # | Item | Category | Effort |
|---|---|---|---|
| 8 | **Replace alert() with toast notifications** | Code Quality | 1 hr |
| 9 | **Add CollectionPage schema** to CategoryPage | SEO | 30 min |
| 10 | **Update robots.txt** with correct production domain | SEO | 5 min |
| 11 | **Add `font-display: swap`** to Google Fonts | Performance/SEO | 5 min |
| 12 | **Extract AdManagementTab** into its own file | Code Quality | 15 min |
| 13 | **Enable `strict: true`** in tsconfig.json | Code Quality | 2 hr (may require fixes) |

### 🔵 Low Priority

| # | Item | Category | Effort |
|---|---|---|---|
| 14 | Add pagination to category pages (`/category/:slug/page/:num`) | SEO | 1 hr |
| 15 | Add `SearchAction` schema for site search box | SEO | 15 min |
| 16 | Add image sitemap for article featured images | SEO | 30 min |
| 17 | Add CSP (Content Security Policy) header | Security | 1 hr |
| 18 | Add WCAG accessibility audit (landmark roles, keyboard nav) | Accessibility | 2 hr |

---

## Appendix: Key File Inventory

| File | Purpose | Lines |
|---|---|---|
| `src/App.tsx` | Root component: routing, SEO, AdSlot, Header, Footer, all page components | ~1600 |
| `src/entry-server.tsx` | SSR entry: pre-fetches articles, renders to string | ~80 |
| `src/entry-client.tsx` | Client hydration entry | ~50 |
| `server.ts` | Express server: SSR middleware, sitemaps, static files | ~240 |
| `src/pages/AdminDashboard.tsx` | Admin panel: articles CRUD, users, ad management, gallery | ~900 |
| `src/components/AuthProvider.tsx` | Authentication context | ~100 |
| `src/lib/supabase.ts` | Supabase client + error handling | ~30 |
| `src/lib/ssrUtils.ts` | SSR-safe browser API wrappers | ~25 |
| `src/types/database.types.ts` | Article, Category, Tag, Author, Media types | ~350 |
| `src/types/seo.types.ts` | OG, Twitter, Breadcrumb, Sitemap types | ~50 |

---

## Appendix: Dependency Health

| Dependency | Version | Notes |
|---|---|---|
| React | ^18.2.0 | Current LTS, stable |
| Vite | ^6.2.0 | Latest major — good |
| Supabase JS | ^2.106.1 | Latest — good |
| react-router-dom | ^7.14.1 | Latest v7 — good |
| TypeScript | ~5.8.2 | Latest — good |
| @uiw/react-md-editor | ^4.1.0 | Active — good |
| lucide-react | ^0.546.0 | Active — good |
| firebase | ^9.22.2 | Legacy — v9, should consider updating or removing if fully on Supabase |
| pdfjs-dist | ^5.7.284 | Active — good |
| mammoth | ^1.12.0 | Stable — good |
| react-quill | ^2.0.0 | Not used in any visible import — consider removing |
| tailwindcss | ^4.1.14 | Latest v4 — good |
| compression, sirv, express | Latest | Production dependencies — good |

---

*Review generated by automated code analysis tools. Recommendations should be validated against project requirements before implementation.*
