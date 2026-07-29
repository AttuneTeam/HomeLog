# Specification — Rental statement capture

**Track ID:** `rental_statement_capture_20260730`
**Type:** Feature
**Status:** New

## Overview

`rental_payments` is the only financial-evidence table in the app with nowhere to store the
document behind the figure. `expenses.invoice_path`, `rental_operating_expenses.invoice_path`,
`loan_statements.storage_path` and `depreciation_reports.storage_path` all exist; migration 044
has no equivalent. Every other figure ships into the tax pack with its evidence attached — rent
alone arrives as a bare number.

The consequence is larger than a missing file. Agent fees are a real ATO rental-schedule line
(`lib/tax/rental-schedule.ts:49`, "Property agent fees and commission"), but the amount is
computed at `app/(dashboard)/properties/[propertyId]/tax-pack/page.tsx:281-286` as
`weeks × weekly_rent × management_fee_pct`. A percentage model can only ever produce a recurring
percentage.

Measured against the reference statement (Rich & Oliva, Account OWN10905, 28 Nov 2025,
56 Forbes St Croydon Park NSW 2133):

| Line | Amount | Reproduced by the % model? |
| --- | --- | --- |
| Gross rent (2 × $2,200) | $4,400.00 | — |
| Management fees | $242.00 | Yes — exactly 5.5% of $4,400 |
| Letting fees | $1,210.00 | **No** — one-off charge |
| Lease fee | $33.00 | **No** — one-off charge |
| Bank & sundries | $8.80 | **No** — one-off charge |
| Supa Blinds (third party) | $2,146.00 | Out of scope — own invoice |
| Net received | $760.20 | — |

The estimate therefore understates deductions by **$1,251.80** on a statement the owner is
already holding. It is also presented with no disclosure that it is an estimate at all, unlike
gross rent (`actual` vs `accrued` in `lib/tax/rental-income.ts`) and loan interest (`confirmed`
vs `estimated`). `product.md` requires estimates to be visibly distinguished from recorded facts;
this figure is not.

This track extends the existing table in place. There are already rows in production, so the
migration is additive and nullable-only and no data migration is required.

## Functional requirements

### FR1 — Schema (migration 063, additive and nullable only)

```
rental_payments
  + statement_path        text          -- property-files bucket
  + management_fees       numeric(10,2) check >= 0
  + letting_fees          numeric(10,2) check >= 0
  + lease_fees            numeric(10,2) check >= 0
  + sundry_fees           numeric(10,2) check >= 0
  + other_outgoings       numeric(10,2) check >= 0  -- reconciliation only, never deducted
  + net_received          numeric(10,2) check >= 0
  + extracted             jsonb
  + confidence            numeric        check between 0 and 1
  + fees_confirmed_at     timestamptz
```

`amount` retains its existing meaning: **gross rent**, the assessable figure. Every new column is
nullable so rows already in the table remain valid and continue to render and edit unchanged.

### FR2 — File-bearing table invariant

The same migration redefines `user_storage_objects()` and `property_storage_objects()` to
enumerate `rental_payments.statement_path` against the `property-files` bucket, resolving
ownership through `properties.user_id` and never by upload-path prefix.

Storage has no database cascade. Per `docs/account-deletion.md`, a storage column absent from
both functions leaks its objects silently on account or property deletion. Resolving ownership by
path prefix instead would reintroduce the cross-owner data-loss bug those functions exist to
prevent.

### FR3 — Upload and extraction

`POST /api/rental-statements/extract`, mirroring `app/api/loan-statements/extract/route.ts`:

- Authenticate, then **store the document before extracting** — a failed extraction must not lose
  the upload.
- Pass the file to Claude via a new `lib/ai/extract-rental-statement.ts`, returning gross rent,
  the four fee buckets, other outgoings, net received, agent name, statement ref, period and a
  confidence score.
- No server-side `pdf-parse`. The comment in the loan-statements route records why that path was
  abandoned: `pdf-parse` lists a `browser` condition first in its exports map, so Vercel's
  bundler resolved a build referencing `DOMMatrix`, and the route returned 500 before any handler
  ran.
- Model wiring stays centralised in `lib/ai/anthropic-client.ts`, not at the call site.
- `fees_confirmed_at` is left null.
- On insert failure, remove the stored object before returning — no row means nothing references
  the file. Translate a row-level-security rejection to 403 with a human-readable message rather
  than raw Postgres text.

### FR4 — Confirmation gate

Extracted fee figures are excluded from the rental schedule until a human sets
`fees_confirmed_at`. Fees typed by hand are confirmed on save, because a human already entered
them. Unconfirmed fees are surfaced as a tax-pack omission, exactly as unconfirmed loan
statements are.

An unconfirmed extraction is a model's proposal, not evidence.

### FR5 — Reconciliation

A pure helper asserts:

```
amount − (management + letting + lease + sundry) − other_outgoings = net_received
```

Tolerance $1.00. **Advisory only — it warns, it never blocks a save.** A balance brought forward
is a legitimate cause of a failed reconcile and must not be reported as user error. Absent
`net_received` is "not applicable", not a failure.

### FR6 — Fee resolution

New `lib/tax/agent-fees.ts` exporting `resolveAgentFees(payments, periods, fyEndYear, …)`,
following the shape of `resolveRentalIncome`:

```ts
{ amount, source: "actual" | "estimated" | null, actual, estimated }
```

Confirmed statement fees are the actual. Where a year has none, the existing `management_fee_pct`
calculation is returned and labelled an estimate, so nothing regresses for properties that have
not been back-filled.

**The two are never summed.** The statement's $242 management fee is exactly what the 5.5%
calculation produces; adding them double-counts it.

### FR7 — Schedule lines

`RentalScheduleInput` gains `agentSundries`. Management, letting and lease fees feed the
`agent_fees` line ("Property agent fees and commission"). `sundry_fees` feeds the existing
`sundry` line ("Sundry rental expenses"), which already exists in `DEDUCTION_ORDER`.

Bank and administrative charges are what the ATO's sundry line is for, and keeping them out of
the commission line means the agent-fees figure stays directly comparable to the estimate it
replaces.

### FR8 — Third-party costs are never deducted here

`other_outgoings` exists solely so the statement ties to the bank. Costs the agent paid to a
third party — the $2,146 of blinds — deduct through their own invoice on the renovation/expense
path, which is also the only path that classifies them correctly as a Division 40 depreciating
asset rather than an immediate deduction.

Deducting them from the statement as well is the single worst failure mode available to this
feature. The column is documented as reconciliation-only in the migration itself, where anyone
adding a deduction path will read it.

### FR9 — Tax pack evidence

Each payment carrying a `statement_path` becomes an `EvidenceItem`:
`kind: "Rental statement"`, `feedsLine: "Gross rent / Property agent fees"`, signed from
`property-files`, with a manifest entry naming the lines it supports.

### FR10 — Rent tab UI

`components/rental-payments-section.tsx` gains:

- a statement upload in the add/edit dialog, with a signed-URL view link;
- the four fee inputs plus other outgoings and net received;
- the reconciliation result, in an advisory tone;
- a Confirm action on extracted figures, with edited-from-extracted visibly distinguished as
  `loan-statements-panel.tsx` already does;
- an "Auto" badge treatment consistent with the existing `source_email_id` marker.

### FR11 — Consistency across views

`components/financial-position-view.tsx:257` routes through `resolveAgentFees`, so it cannot
report a different agent-fee figure from the tax pack for the same property and year. Two
surfaces disagreeing on the same number is the kind of inconsistency that costs trust.

## Non-functional requirements

- **Tier 1** (`lib/tax/agent-fees.ts`, the reconciliation helper, the migration, RLS): unit tests
  written first, Red/Green. Migration verified with `npm run db:reset` for a clean replay, and
  access confirmed **denied** for a non-owner — not only allowed for the owner.
- No new RLS policy is required: migration 062's `has_property_read_access` /
  `has_property_write_access` policies cover the new columns. This must be **verified, not
  assumed**.
- `property-files` stays private; access via signed URLs only.
- All amounts AUD. Extraction is mocked with fixtures in tests — never a live model call.
- No `any`; `database.types.ts` updated by hand.

## Acceptance criteria

1. Statement OWN10905 uploads against the existing $4,400 payment; extraction proposes
   $242 / $1,210 / $33 / $8.80, `other_outgoings` $2,146 and `net_received` $760.20.
2. Reconciliation passes: `4400 − 1493.80 − 2146 = 760.20`.
3. Before confirmation, agent fees are unchanged and the pack lists the statement as awaiting
   confirmation.
4. After confirmation, the schedule shows **$1,485.00** agent fees (management + letting + lease)
   and **$8.80** sundry, both labelled actual — up from the $242 estimate.
5. The blinds appear exactly once in deductions, via their own invoice, classified as
   capital / Division 40 — never as a rental deduction.
6. A property with no statement for the year still shows the percentage estimate, visibly
   labelled an estimate.
7. The statement PDF is present in the generated ZIP with a manifest entry naming the lines it
   supports.
8. Existing `rental_payments` rows render and edit unchanged.
9. `npm run db:reset` replays cleanly; a non-owner is denied select and update.
10. `npm run build` and `CI=true npm test` both pass.

## Out of scope

- **`lib/xero/mapper.ts:246`** — also computes agent fees from `management_fee_pct`, but it posts
  real journals. Changing what it writes deserves its own track and verification against a real
  tenant.
- **One statement spanning multiple payment rows.** One statement equals one payment row, matching
  how statements are already entered — OWN10905's two $2,200 rent lines were recorded as a single
  $4,400 payment.
- **Inbound-email auto-attachment** of statement PDFs to matched payments.
- **Back-filling or auditing historical `rental_payments`** for gross-versus-net entry.

## Known risks

- **Gross-versus-net in existing rows.** `amount` must mean gross rent. If any earlier row was
  entered as the amount that reached the bank rather than the gross figure, it understates
  assessable income. The reference row is correct at $4,400, but a one-off check of historical
  rows is worth doing outside this track.
- **Double-counting third-party costs.** Mitigated by FR8 and acceptance criterion 5, but this is
  the failure mode to guard in review.
