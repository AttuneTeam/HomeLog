# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Home Base is a property-investment tracking app for Australian investors. It tracks properties,
renovations, expenses, loans, and rental income, and uses AI to classify expenses against ATO tax
rulings (deductible / capital works / depreciable), extract data from invoices, and enrich property
records. Stack: Next.js 16 (App Router) + React 19, TypeScript, Tailwind v4, Supabase
(Postgres + pgvector + Auth + Storage), and the Vercel AI SDK over Anthropic + OpenAI.

## Commands

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build (also runs tsc via next)
npm run start        # Serve production build

npm run db:migrate   # supabase migration up — apply pending migrations to local DB
npm run db:reset     # supabase db reset — wipe + replay all migrations from scratch
npm run db:sync      # scripts/sync-from-prod.sh — copy prod DB rows + storage into local

npm run seed:ato     # Seed/embed the ATO rulings corpus into ato_rulings_embeddings (RAG)
npm run seed:demo    # Seed a demo property with renovations/expenses
```

There is no test suite or linter configured; `npm run build` (tsc) is the only correctness gate.
Local Supabase runs via the `supabase` CLI (`supabase start`); local DB is at
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## Architecture

### Auth & request gating
- `proxy.ts` (Next 16's middleware-equivalent, exporting `proxy`) calls `updateSession` in
  `lib/supabase/middleware.ts` on every non-static request. It refreshes the Supabase session
  cookie and redirects: unauthenticated users → `/login`, authenticated users away from auth pages
  → `/properties`. Public path prefixes (landing, `/login`, `/signup`, `/auth`, `/invite`,
  `/passport`, and their APIs) are allowlisted there — **add new public routes to that list**.
- Three Supabase clients in `lib/supabase/`: `server.ts#createClient` (RLS-scoped, anon key, for
  Server Components / actions / routes — the default), `server.ts#createAdminClient`
  (service-role key, bypasses RLS — use only for webhooks/system tasks like inbound email),
  and `client.ts` (browser).
- Every Server Action and API route does `supabase.auth.getUser()` and bails on no user; **data
  isolation is enforced by Postgres RLS**, not app code. Ownership/sharing is modelled via
  `account_members`, `property_shares`, and `property_passport_links` tables with RLS policies
  (see migrations 027–034).

### Mutations vs. reads
- **Server Actions** live in `app/actions/*.ts` (`"use server"`) — used for form submissions and
  CRUD from client components.
- **API routes** in `app/api/*` handle AI pipelines, third-party webhooks/OAuth (Xero, Resend),
  and anything streaming or long-running. Dynamic routes take params as `Promise` (Next 16):
  `{ params }: { params: Promise<{ id: string }> }`, then `await params`.

### Route groups
- `app/(dashboard)/` — the authenticated app (properties, financial, contractors, import,
  settings), wrapped by `layout.tsx` with the dashboard shell.
- `app/(story)/` and `app/passport/[token]/` — public, tokenized read-only "property passport"
  shares; no auth required.

### AI / RAG pipeline (the core differentiator)
See `docs/rag-tax-classification.md` for the full diagram. Two-step flow triggered from
`components/ai-tax-classification-panel.tsx`:
1. `POST /api/extract/[expenseId]` — downloads the invoice from Supabase Storage, extracts text
   (`pdf-parse` for PDFs, Claude Vision for images), chunks it, embeds with OpenAI
   `text-embedding-3-small` (1536-dim), stores vectors in `expense_embeddings` (pgvector).
2. `POST /api/classify/[expenseId]` — embeds a query, runs a cosine similarity search against
   `ato_rulings_embeddings` via the `match_ato_rulings()` RPC (top-5), builds a RAG prompt, and
   calls Claude with `generateObject` + a Zod schema (`lib/ai/classification-schema.ts`).
- Model wiring is centralized: `lib/ai/anthropic-client.ts` (Claude `claude-sonnet-4-6` for
  classification + vision) and `lib/ai/openai-client.ts` (embeddings + extraction). Change models
  there, not at call sites.

### Integrations
- **Xero** (`lib/xero/`, `app/api/xero/`): OAuth2 PKCE connect, account/tracking-category mapping,
  and expense export. PKCE state is signed via `XERO_PKCE_COOKIE_SECRET`.
- **Resend email** (`lib/email.ts`, `app/api/inbound-email/`): inbound webhook (Svix-signature
  verified) parses emailed rental statements/receipts and matches them to properties; outbound
  sends invites and password resets.

## Database conventions

- Migrations live in `supabase/migrations/NNN_description.sql`, applied in numeric order. Always
  add a new sequentially-numbered file; never edit an applied migration.
- `lib/supabase/database.types.ts` is **hand-maintained** — do NOT run `supabase gen types`. When
  you add a table, hand-add its row type and an entry under the `Database["public"]["Tables"]`
  interface.
- Local seed scripts authenticate with the **public anon `signUp`/`signIn` flow**, not the
  auth-admin API (the local service key is rejected on the auth admin endpoint).

## Conventions

- Path alias `@/*` maps to the repo root (e.g. `@/lib/supabase/server`).
- UI uses shadcn components (`components.json`, built on `@base-ui/react`) + Tailwind v4; `cn()`
  from `lib/utils.ts` merges classes. Toasts via `sonner`.
- Domain math is isolated in `lib/finance-utils.ts`, `lib/tax-utils.ts`, `lib/stamp-duty.ts`.
- All amounts are AUD; tax logic targets the Australian ATO / financial-year model.
