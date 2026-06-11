# AI Agent Instructions for LIN Project

This document provides context and guidelines for AI agents (like Gemini, Claude, Cursor, or Windsurf) working on the **LIN (Local Insight Network)** project.

## 🤖 System Context
- **Architecture:** React 18 + TypeScript + Vite + Express (SSR Engine).
- **Primary Backend:** Supabase (PostgreSQL) for Data, Storage, and RBAC.
- **Auth Provider:** Supabase Auth (Primary) / Firebase Auth (Legacy/Optional).
- **Deployment:** Self-hosted via PM2 and Nginx.

## 🎯 Critical Mandates for AI Agents

### 1. SSR Safety (The "Window" Rule)
This is a Server-Side Rendering (SSR) project.
- **Rule:** NEVER use `window`, `document`, `localStorage`, or any browser-only APIs outside of `useEffect` or `typeof window !== 'undefined'` checks.
- **Why:** Using these APIs directly will crash the `server.ts` build process.

### 2. Database Integrity (SQL First)
- **Rule:** Always check `supabase/migrations/` before proposing schema changes.
- **Workflow:** Do not modify the database via client-side code only. Propose SQL migration scripts for any new tables or RLS policies.
- **RLS:** All tables MUST have Row Level Security enabled.

### 3. SEO & Metadata
- **Rule:** All pages must use `Helmet` for meta tags.
- **Rule:** Ensure `server.ts` is updated if new dynamic route patterns are added to maintain proper 404 HTTP status codes.

### 4. Hydration Consistency
- **Rule:** Ensure the initial state in `AuthProvider` and `initialArticles` remains consistent between server and client to prevent Hydration Mismatch errors.

## 🛠️ Common Troubleshooting for AI
- **Error: "Hydration failed"**: Check if the server-rendered HTML matches the client's first render. Check `AuthProvider` initial state.
- **Error: "process is not defined"**: Ensure environment variables are accessed via `process.env` in `server.ts` and `import.meta.env` in Vite-client files.
- **Error: "Supabase Error: 42501"**: This is an RLS policy violation. Check the SQL policies in `supabase/migrations/`.

## 📂 Navigation Tips
- **Logic:** `src/lib/`
- **UI:** `src/components/`
- **Routing:** `src/App.tsx`
- **SSR Logic:** `server.ts`, `src/entry-server.tsx`, `src/entry-client.tsx`

---
*Note: Always verify that any changes to `server.ts` do not break the production build (`npm run build:ssr`).*
