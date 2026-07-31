# Rental statements & agent fees

The **invariants and gotchas** behind rent payments and the managing agent's statement — the
things not recoverable from any single file. For the actual logic, follow the pointers; do not
duplicate it here.

## The core invariant: `rental_payments.amount` is GROSS rent

Gross rent is the owner's assessable income. The agent's fees and the money they pay to third
parties are **deductions in their own right**, not reductions in income. What actually reached the
bank belongs in `net_received`.

This rule is invisible from any one file, which is exactly why it broke:
`lib/email-parser/parse-statement.ts` used to instruct the model to store the *net amount
disbursed* in `amount`, while `lib/tax/rental-income.ts#actualRentForFy` sums that same column and
reports it as gross rent. Every email-ingested payment understated assessable income by the whole
of the agent's fees and outgoings. Nothing failed; the number was just wrong.

⚠️ **If you change what writes `amount`, check `actualRentForFy` first.** A column whose meaning is
set in one file and consumed as something else in another is the failure this doc exists to
prevent.

### Who may write `amount`

| Path | Writes `amount`? |
|---|---|
| Inbound email (`app/api/inbound-email/handler.ts`) | Yes — on insert |
| Statement upload (`app/api/rental-statements/extract/route.ts`) | **No, deliberately** |
| Confirm action (`app/actions/rental-statements.ts`) | Yes |
| Rent tab dialog (`components/rental-payments-section.tsx`) | Yes |

The upload route not writing `amount` looks like an omission. It isn't: an unconfirmed extraction
replacing a recorded income figure would change reported income with nobody agreeing to it — and
that figure may already have been corrected by hand. The proposal is carried in `extracted` for the
confirm step to apply.

## `other_outgoings` is never a deduction

It records what the agent paid to third parties **solely so the statement reconciles to the bank**.
Those costs are claimed from the supplier's own invoice, which is the only path that classifies
them correctly — blinds are a depreciating asset, not an immediate repair.

⚠️ **Adding a deduction path from this column double-counts every such cost.** The migration header
for `063` says so at the point of definition, because that is where someone will be tempted.

## Actual and estimated agent fees are never summed

`lib/tax/agent-fees.ts` resolves fees from confirmed statements, falling back to
`rental_periods.management_fee_pct` and labelling the result an estimate.

⚠️ **They must never be added together.** The statement's management fee is *exactly* what the
percentage calculation produces — summing them double-counts it.

The percentage can only ever reproduce a recurring charge. Against one real annual summary it
recovered the $1,573 management fee and missed $1,278 of one-off letting, lease and bank charges.
That is the whole reason recorded statements are preferred.

### Why `partial` exists

When only *some* payments in a year have confirmed fees, the actual is genuine but incomplete — and
can be **smaller than the estimate it displaced**. Observed: $1,493.80 actual from one statement of
seven, against a $1,728.57 estimate and a true $2,851.20. Silently preferring the actual would
understate the deduction with nothing on the page explaining why, which is the inverse of the
defect this area was built to fix. The tax pack turns the flag into a stated omission.

## Other income is kept out of gross rent

Tenant reimbursements (water usage) are assessable, but on the ATO's *separate* line. Two reasons
they must not be folded into `amount`:

1. Gross rent is cross-checked against the tenancy accrual (`weekly_rent × weeks`) in
   `rental-income.ts`. Non-rent income makes that diverge for a legitimate reason, turning a useful
   warning into noise.
2. The reconciliation in `lib/tax/statement-reconciliation.ts` is
   `(rent + other income) − fees − outgoings = disbursed`. Without the column it reports **correct**
   statements as broken, by exactly the reimbursement.

The reconciliation is **advisory and never blocks a save** — a balance brought forward legitimately
breaks the identity, and a check that fires on normal cases is one people learn to ignore.

## Gotcha: two extractors, and only one is trustworthy for money

| Path | Mechanism | Reliability |
|---|---|---|
| `lib/email-parser/parse-statement.ts` | OCR → text → freeform JSON | Varies per run |
| `lib/ai/extract-rental-statement.ts` | Native PDF → `generateObject` + Zod | Exact in testing |

Three runs of the email parser over the *same* statement returned third-party outgoings as absent,
then `2146`, then `3148`, and each time copied the amount disbursed into `other_income` — which
would report income that does not exist. One run declared **confidence 1.0 while wrong**, so
confidence cannot be used to filter it.

The inbound handler therefore reads a PDF statement with `extractRentalStatementFields` and keeps
the email parser only for deciding rental-vs-expense and matching the property.

⚠️ **`other_income` is assigned with a ternary on `fields`, not `??`.** The email parser's value
there is actively wrong rather than merely absent, so `??` would let a legitimate `null` from the
structured extractor fall back to a fabricated number.

## Known defect, not fixed here: Division 40 double claim

An expense classified `Repair` flows straight to the repairs deduction line with no awareness of
what a quantity surveyor already depreciated. Verified on real data: a $2,146 blinds expense is
deducted **in full** as a repair while the same asset is itemised in the QS Division 40 schedule.

The analogous Division 43 overlap **is** guarded — when a QS report exists,
`depreciation_reports.div43_annual` supersedes the internal register (see the tax-pack page). No
equivalent guard exists for Division 40.

Compounding it: the expense vocabulary is `Repair | Capital Works | Immediate Repair`
(`lib/tax/classification.ts`). There is no way to record "this is a depreciating asset", so even a
correct answer from an accountant cannot be entered. Needs its own track.

## Gotcha: locally synced documents are unreachable

`scripts/sync-from-prod.sh` writes storage objects under a **doubled** bucket prefix
(`property-files/property-files/…`), so a document synced from production 500s at the path the
app uses. Affects any local test that downloads a stored file.

## Maintenance rule

Adding a column that holds a **figure the tax pack reports**? Decide and write down, at the point
of definition, (a) whether it is income or a deduction, and (b) which write paths may set it.
Both mistakes in this area — net stored as gross, and other income with nowhere to live — were
columns whose meaning was clear to the author and ambiguous to the next reader.

`statement_path` is a **file-bearing column**: see the maintenance rule in
[account-deletion.md](./account-deletion.md), which it is already registered in.

## Verification

| Command | Covers |
|---|---|
| `npm run verify:rent-extract` | Live extraction against real statement PDFs |
| `npm run verify:rent-route` | Upload route over real HTTP, incl. another user's payment |
| `npm run verify:inbound-statement` | Forwarded email → stored statement → extracted figures |
| `npm run verify:rent-ingest` | Column mapping end to end |
| `npm run verify:rent-schedule` | Schedule computed from live data |
| `npm run verify:deletion` | Statement objects removed with the property |

These make **live model calls** and are scripts, not tests — `workflow.md` forbids calling a
provider from the suite. The pure logic (`lib/tax/agent-fees.ts`,
`lib/tax/statement-reconciliation.ts`, the extraction schemas) is unit-tested.

## Deploy notes

Migrations `063`, `064` and `065` must be applied to production **before** the code that depends on
them. `064` extends the storage-object functions; skipping it leaks statement files on deletion.

Rows ingested before the parser was corrected still hold the **net** figure in `amount`.
`scripts/fix-rental-payment-gross-net.ts` corrects rows whose source statement is available and
flags the rest — it is dry-run by default and idempotent. It has been run locally only; a
`db:sync` discards that, so the production run is what makes it durable.
