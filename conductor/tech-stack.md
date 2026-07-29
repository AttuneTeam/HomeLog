# Technology Stack — Home Base

## Language & runtime

- **TypeScript 5** — strict mode. Path alias `@/*` maps to the repository root
  (e.g. `@/lib/supabase/server`).
- **Node.js** — `tsx` runs standalone scripts in `scripts/`.

## Framework

- **Next.js 16.1.6** (App Router) with **React 19.2.3**.
- Server Components are the default. Client components are opt-in via `"use client"`.
- **Mutations** live in Server Actions under `app/actions/*.ts` (`"use server"`) — used for form
  submissions and CRUD from client components.
- **API routes** in `app/api/*` handle AI pipelines, third-party webhooks and OAuth, and anything
  streaming or long-running.
- Dynamic route params are Promises in Next 16: `{ params }: { params: Promise<{ id: string }> }`,
  then `await params`.
- **`proxy.ts`** at the repo root is Next 16's middleware equivalent (exports `proxy`). It calls
  `updateSession` in `lib/supabase/middleware.ts` on every non-static request.

### Route groups

- `app/(dashboard)/` — the authenticated app: properties, financial, contractors, import,
  settings. Wrapped by `layout.tsx` with the dashboard shell.
- `app/(story)/` and `app/passport/[token]/` — public, tokenised read-only property passport
  shares. No auth required.

## Styling & UI

- **Tailwind v4** via `@tailwindcss/postcss`.
- **shadcn** components (`components.json`) built on **`@base-ui/react`**, living in
  `components/ui/`.
- `cn()` from `lib/utils.ts` merges classes (`clsx` + `tailwind-merge`).
- **`lucide-react`** icons, **`next-themes`** for light/dark, **`sonner`** for toasts,
  **`recharts`** for charts, **`tw-animate-css`** for animation utilities.

## Database, auth & storage

- **Supabase** — Postgres with **pgvector**, Auth (including Google SSO), and Storage.
- Three clients in `lib/supabase/`:
  - `server.ts#createClient` — RLS-scoped, anon key. The default for Server Components, actions
    and routes.
  - `server.ts#createAdminClient` — service-role key, bypasses RLS. Only for webhooks and system
    tasks such as inbound email.
  - `client.ts` — browser.
- **Data isolation is enforced by Postgres RLS**, not application code. Every Server Action and
  API route still calls `supabase.auth.getUser()` and bails when there is no user, as defence in
  depth.
- Ownership and sharing are modelled via `account_members`, `property_shares` and
  `property_passport_links` with corresponding RLS policies.
- **Storage buckets:** `invoices` and `property-files`, both private, accessed through signed URLs.

### Database conventions

- Migrations live in `supabase/migrations/NNN_description.sql` and apply in numeric order. Always
  add a new sequentially-numbered file; **never edit an applied migration.**
- **`lib/supabase/database.types.ts` is hand-maintained.** Do NOT run `supabase gen types`. When
  adding a table, hand-add its row type and an entry under `Database["public"]["Tables"]`.
  Because it is hand-maintained it can drift from the schema — a column that type-checks is not
  proof the column exists.
- Local seed scripts authenticate with the public anon `signUp` / `signIn` flow, not the auth-admin
  API (the local service key is rejected on the auth admin endpoint).
- Local Supabase runs via the `supabase` CLI (`supabase start`); the local DB is at
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## AI

- **Vercel AI SDK v6** (`ai`) over two providers.
- **`@ai-sdk/anthropic`** — Claude for tax classification and vision-based invoice extraction.
  Wired in `lib/ai/anthropic-client.ts`.
- **`@ai-sdk/openai`** — `text-embedding-3-small` (1536-dim) embeddings and extraction. Wired in
  `lib/ai/openai-client.ts`.
- **Model wiring is centralised in those two files. Change models there, not at call sites.**
- **`zod` v4** schemas drive `generateObject` for structured output
  (`lib/ai/classification-schema.ts`).
- **`pdf-parse`** for PDF text extraction; Claude Vision for images.
- **`@tavily/core`** for property enrichment web search.

### RAG pipeline

Two steps, triggered from `components/ai-tax-classification-panel.tsx`:

1. `POST /api/extract/[expenseId]` — downloads the invoice from Storage, extracts text, chunks,
   embeds, and stores vectors in `expense_embeddings`.
2. `POST /api/classify/[expenseId]` — embeds a query, runs cosine similarity against
   `ato_rulings_embeddings` via the `match_ato_rulings()` RPC (top-5), builds a RAG prompt, and
   calls Claude with `generateObject` plus a Zod schema.

See `docs/rag-tax-classification.md` for the full diagram.

## Integrations

- **Xero** (`lib/xero/`, `app/api/xero/`) — OAuth2 PKCE connect, account and tracking-category
  mapping, multi-line manual journal posting. PKCE state is signed via
  `XERO_PKCE_COOKIE_SECRET`.
- **Resend** (`lib/email.ts`, `app/api/inbound-email/`) — inbound webhook (Svix-signature
  verified) parses emailed rental statements and receipts and matches them to properties;
  outbound sends invites and password resets.

## Reporting & forms

- **`@react-pdf/renderer`** — generated tax report PDFs (`components/tax-report-pdf.tsx`).
- **`xlsx`** — spreadsheet export.
- **`react-hook-form`** + **`@hookform/resolvers`** + zod for form validation.

## Domain logic

Isolated in dedicated modules rather than spread through components:

- `lib/finance-utils.ts` — loan and ROI mathematics.
- `lib/tax-utils.ts` — ATO income tax brackets and Medicare levy.
- `lib/stamp-duty.ts` — stamp duty across all eight Australian jurisdictions.

All amounts are AUD; tax logic targets the ATO and the Australian financial-year model.

## Commands

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build (also runs tsc via next)
npm run start        # Serve production build

npm run db:migrate   # supabase migration up — apply pending migrations to local DB
npm run db:reset     # supabase db reset — wipe + replay all migrations
npm run db:sync      # scripts/sync-from-prod.sh — copy prod DB rows + storage into local

npm run seed:ato     # Seed/embed the ATO rulings corpus into ato_rulings_embeddings
npm run seed:demo    # Seed a demo property with renovations/expenses
npm run verify:deletion  # Verify account-deletion invariants

npm test             # Vitest (watch); CI=true npm test runs once
npm run test:run     # Vitest, single run
```

## Testing

- **Vitest** (`vitest.config.ts`) — `environment: "node"`, picking up `tests/**/*.test.ts`.
- Tests live in **`tests/`**, mirroring the source tree (`lib/tax/fy.ts` →
  `tests/lib/tax/fy.test.ts`). They are not colocated with source, so the `app/` tree stays free
  of files Next.js would otherwise try to route.
- The config re-declares the `@/*` → `./*` alias from `tsconfig.json`. `tests/smoke.test.ts`
  asserts that alias resolution works, so a regression there fails loudly rather than as an
  opaque module-not-found across the whole suite.
- Coverage currently targets **pure modules only** — domain math and parsers. Anything requiring
  a browser or a live Supabase connection is verified per the tiers in `conductor/workflow.md`.

## Quality gates

- **`npm run build`** (tsc) — the baseline gate. Must pass for every change.
- **`CI=true npm test`** — Vitest, single run. `CI=true` suppresses watch mode.

No linter is configured. Style is enforced by review against `conductor/code_styleguides/`
rather than automatically; adding ESLint remains an open opportunity.

Test coverage is young. It exists for pure domain logic and grows outward per the target state in
`conductor/workflow.md`. Changes to RLS policies, deletion logic or migrations still require
manual verification against a local database — no automated coverage exists for them yet.

`docs/account-deletion.md` documents non-obvious deletion invariants (storage must be deleted by
data ownership, not by upload path prefix; auth-user deletion uses an RPC, not the GoTrue admin
API). Read it before changing deletion logic or adding a file-bearing table.
