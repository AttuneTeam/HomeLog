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

Migration 064 redefines `user_storage_objects()` and `property_storage_objects()` to enumerate
`rental_payments.statement_path` against the `property-files` bucket, resolving ownership through
`properties.user_id` and never by upload-path prefix.

> **Amended during implementation.** This was originally specified as part of migration 063. It is
> a separate file because 063 is applied before the function work begins, and editing an applied
> migration is forbidden. This also matches the existing `055_loan_statements` /
> `058_deletion_fns_new_file_tables` precedent.

Storage has no database cascade. Per `docs/account-deletion.md`, a storage column absent from
both functions leaks its objects silently on account or property deletion. Resolving ownership by
path prefix instead would reintroduce the cross-owner data-loss bug those functions exist to
prevent.

### FR3 — Upload and extraction

`POST /api/rental-statements/extract`, mirroring `app/api/loan-statements/extract/route.ts`:

- Authenticate, then **store the document before extracting** — a failed extraction must not lose
  the upload.
- Pass the file to the extraction model via a new `lib/ai/extract-rental-statement.ts`, returning
  gross rent, the four fee buckets, other outgoings, net received, agent name, statement ref,
  period and a confidence score.

  > **Amended during implementation.** This originally said "Claude". It uses `extractionModel`
  > from `lib/ai/openai-client.ts`, because CLAUDE.md assigns extraction to `openai-client` and
  > classification/vision to `anthropic-client`, and `extract-loan-statement.ts` — the module this
  > mirrors — does the same. Model wiring stays centralised rather than overridden at a call site.
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

### FR12 — Correct the gross-versus-net defect

> **Added during implementation**, after the defect was found in code while verifying FR1. It was
> previously listed as an out-of-scope hypothetical risk. It is neither hypothetical nor a
> data-entry mistake.

`lib/email-parser/parse-statement.ts:51` instructs the extraction model:

> `amount is the net amount disbursed to the owner — look for "You Received", "Withdrawal by
> EFT", or "Net to owner", NOT the gross rent income figure`

`lib/tax/rental-income.ts#actualRentForFy` then sums that column and reports it as **gross rent**,
feeding `schedule.grossRent`. Every payment ingested from an agent email therefore understates
assessable rental income by the whole of the agent's fees and outgoings. Six of the seven rows in
the local database arrived this way and none is a multiple of the $1,100 weekly rent.

This is fixed inside this track rather than deferred, because the track introduces `net_received`,
which is exactly where the parser's figure belongs — and because shipping a migration whose stated
invariant the app's own ingestion path contradicts would be worse than a larger track.

- `amount` extracts **gross rent**; `net_received` takes the disbursed figure.
- The fee buckets and `other_outgoings` are extracted at the same time, since the prompt is being
  rewritten anyway.
- Ingested rows are **not** auto-confirmed: `fees_confirmed_at` stays null so extracted fees go
  through the same FR4 review gate as an uploaded statement.
- Affected historical rows are restated. Any row that cannot be corrected without its source
  document is reported, not guessed.

### FR14 — Other rental-related income

> **Added during implementation**, after the FY2026 annual summary showed $44.84 of water usage
> recovered from the tenant that the model cannot represent.

Amounts a tenant reimburses the owner for are assessable rental income, and the ATO rental
schedule carries them on a separate line from gross rent. The system currently has nowhere to put
them: `rental_payments.amount` is gross rent, and there is no other income field.

This is not merely a missing figure — **the reconciliation in FR5 is incorrect without it.** The
December 2025 statement carries $6.80 of water recovery:

```
Money In:  rent 4,400.00 + water 6.80 = 4,406.80
Money Out:                                387.86
Net:                                    4,018.94   ✓
```

FR5's identity computes `4400 − 387.86 = 4012.14` against a stated net of `4018.94` and reports a
correct statement as broken. Every period with a tenant reimbursement would trip it.

- Migration 065 adds `other_income numeric(10,2)` and `other_income_note text`.
- FR5's identity becomes `(amount + other_income) − fees − other_outgoings = net_received`.
- `RentalScheduleInput` gains `otherIncome`, surfaced as **"Other rental-related income"** — a
  separate line, so gross rent stays comparable to the tenancy accrual cross-check in
  `lib/tax/rental-income.ts`, which compares against `weekly_rent × weeks` and would be broken by
  folding non-rent income into it.
- The parser extracts it, with `other_income_note` recording what it was for.

### FR13 — Fees are GST-inclusive

The statement's $242 management fee is $220 plus 10% GST. The `management_fee_pct` estimate
computes the ex-GST figure. Residential rent is input-taxed, so the owner cannot claim a GST credit
and the **GST-inclusive** amount is the deductible one. Recorded fee columns therefore hold the
GST-inclusive figure as it appears on the statement, and the estimate fallback understates every
fee by its GST — a further reason the actual is preferred wherever it exists.

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
5. The blinds appear exactly once **from the rental-statement side**: `other_outgoings` records
   the $2,146 so the statement reconciles, and never contributes a deduction. Their classification
   is out of scope — see the finding below.

   > **Amended during implementation.** This originally required the blinds to be "classified as
   > capital / Division 40". That is not achievable: the expense vocabulary is
   > `Repair | Capital Works | Immediate Repair` (`lib/tax/classification.ts`), and Division 40
   > reaches the schedule only through `depreciation_reports.div40_annual`, a quantity surveyor's
   > figure for the whole property. There is no way to mark an individual expense as a Division 40
   > depreciating asset. The criterion was written from the tax treatment without checking the model
   > supported it. What it was actually protecting — the double-count guard on `other_outgoings` —
   > is what it now asserts.
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
~~**Back-filling or auditing historical `rental_payments`** for gross-versus-net entry.~~ **Moved
into scope** as FR12 / Phase 1.5 — the cause was found in code, not in data entry.

## Acceptance criteria added by the amendment

11. The parser test fixture asserts `amount` is gross rent ($4,400 for OWN10905), not the disbursed
    $760.20, and fails against the pre-amendment prompt.
12. A newly ingested agent email writes gross to `amount`, the disbursed figure to `net_received`,
    the fee buckets to their columns, and leaves `fees_confirmed_at` null.
13. Every historical row whose `amount` came from the parser is either restated as gross or
    explicitly reported as uncorrectable without its source document.

## Finding: Division 40 double claim (out of scope, needs its own track)

Found while trying to satisfy the original acceptance criterion 5. **Verified against the source
documents, not inferred.**

The DuoTax schedule stored against 56 Forbes St itemises its Division 40 assets:

| Client-owned item | Cost | Effective life | Rate | FY2026 |
|---|---|---|---|---|
| Air-conditioning — packaged | $7,750 | 15 yr | 13.33% | $275 |
| **Blinds** | **$2,146** | 10 yr | 20% | **$280** |
| | | | **Div 40 total** | **$555** |

`depreciation_reports.div40_annual` is $555, which is exactly these two.

**The blinds are claimed twice.** The expense carries `manual_classification = "Repair"`, so
`buildRentalSchedule` adds the full $2,146 to the repairs deduction line, while the same asset is
also depreciated at $280 in the Division 40 line. FY2026 deductions are overstated by $2,146.

**The air conditioner is not**, and the reason is instructive: it is classified `Capital Works`, and
the pack already guards that overlap — when a QS report exists,
`depreciationReport.div43_annual` supersedes the internal `div43Register`
(`tax-pack/page.tsx`), so the $7,755 expense cannot double up against DuoTax's Division 43 figure.

**So the design solved this problem once, for Division 43, and the Division 40 path was never
covered.** An expense classified `Repair` flows straight to the repairs line with no awareness of
what the quantity surveyor already depreciated.

Two things are needed, neither belonging to this track:

1. A guard so a `Repair` expense the QS has already scheduled cannot also be deducted in full.
   This needs a way to know which expenses the QS covered.
2. A Division 40 classification for an expense, so the answer an accountant gives can be recorded
   at all. Today the only options are wrong for a depreciating asset.

The classification decision itself belongs to the investor and their accountant — `product.md` is
explicit that classification is a recommendation for review, and no expense was reclassified here.
What is *not* a judgement call is that the system currently emits a double-claimed total, which
nobody chose. Notably DuoTax has already made the call: they treated the blinds as Division 40 with
a 10-year life, so the `Repair` classification contradicts a schedule already in the account.

## Known risks

- **Double-counting third-party costs.** Mitigated by FR8 and acceptance criterion 5, but this is
  the failure mode to guard in review.
- **An edit can silently clear confirmed statement fees.** `onSubmit` in
  `components/rental-payments-section.tsx` writes whatever the fee inputs currently hold, so a save
  with those fields empty nulls the fees, the other-income and net-received figures, and
  `fees_confirmed_at` — with no warning. Observed in practice: statement #7's transcribed figures
  ($121.00 management, $4.40 sundry, $2,074.60 received) were lost this way during UI testing. The
  corrected `amount` of $2,200.00 survived.

  **Consequence:** FY2026 agent fees currently resolve to $1,493.80 instead of $1,619.20, and the
  pack falls back further toward the estimate than the evidence on hand justifies.

  **Decision (2026-07-30):** the owner chose to record this rather than fix it in this track. A
  guard would require an explicit confirmation before a save clears previously-confirmed fees.
  Restoring #7 is one command: `npx tsx scripts/fix-rental-payment-gross-net.ts --apply` after
  clearing the idempotency guard, or re-entering the three figures by hand.
- **Historical correction depends on source documents.** Statements #2–#7 are needed to restate
  those rows. Where a statement is unavailable the row stays flagged rather than being back-solved
  from an assumed fee percentage, which would fabricate a figure.
- **The parser change affects live ingestion.** Once repointed, an incoming agent email writes
  different values into `amount`. Rows ingested between the parser fix and the historical
  correction must not be double-corrected.
