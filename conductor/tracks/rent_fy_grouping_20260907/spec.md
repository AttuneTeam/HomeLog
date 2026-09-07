# Spec — Financial-year grouping on the Rent tab

**Type:** Feature
**Status:** Draft

## Overview

The Rent tab renders rental payments and operating expenses as two flat, date-sorted lists. A
property held for several years produces one long undifferentiated scroll, and the only money
figures on screen are whole-of-ownership totals. Neither list tells the investor what a given
financial year did — which is the only question that matters at tax time, and the unit the tax
pack is built in.

This track groups both lists by financial year in place. Rows stay in one continuous,
always-visible list; a sticky subtotal divider is injected wherever the financial year changes and
remains pinned while that year's rows scroll past. No year is hidden, nothing collapses, and no
row is filtered away.

Grouping follows the ATO cash basis — a payment belongs to the year it was received, an expense to
the year it was incurred — so what the user reads on the Rent tab agrees with what lands in their
tax pack.

## Functional Requirements

### FR1 — Financial-year grouping module

- A new pure module `lib/tax/fy-grouping.ts` exposes a generic grouping function that takes a
  list of items, an accessor returning each item's `yyyy-mm-dd` date, and the financial-year
  start month/day, and returns groups.
- Each group carries `fyEndYear`, the display `label` (e.g. "2025–26"), and its `items`.
- Groups are ordered newest financial year first.
- Item order **within** a group is the order supplied by the caller. Both call sites already sort
  by date descending, so the module must not re-sort and must not assume sorted input.
- The financial year an item falls into is derived by reusing `currentFyEndYear` from
  `lib/tax/fy.ts`. No new calendar arithmetic is introduced.
- Dates are parsed as UTC (`${date}T00:00:00Z`), consistent with the UTC discipline documented at
  the top of `lib/tax/fy.ts`. Parsing `yyyy-mm-dd` via the local-time `Date` constructor shifts
  the day backwards in Australian timezones and would place a 1 July payment in the prior year.
- Items whose date is missing or unparseable are collected into a single trailing group labelled
  "Undated" rather than being dropped. A dropped row would make the per-year subtotals fail to
  reconcile with the lifetime total shown in the same card, which is exactly the kind of silent
  disagreement that costs the user trust in the figures.

### FR2 — Financial-year boundary comes from the user's profile

- The Rent tab page fetches `financial_year_start_month` and `financial_year_start_day` from
  `profiles`, falling back to `AU_FY_START_MONTH` / `AU_FY_START_DAY`.
- Both values are passed to `RentalPaymentsSection` and `RentalExpensesSection`.
- This mirrors `app/(dashboard)/properties/[propertyId]/tax-pack/page.tsx:116`. Without it, a user
  on a non-July financial year would see the Rent tab and their tax pack assign the same payment
  to different years.
- The profile read joins the existing `Promise.all` on the page rather than adding a serial round
  trip.

### FR3 — Rental payments: grouped rows and sticky dividers

- Payments are grouped by `payment_date`.
- A divider row precedes each year's rows, showing:
  - the financial-year label (e.g. "2025–26"),
  - the count of payments in that year,
  - total agent fees for that year, shown only when greater than zero,
  - total **gross** rent for that year.
- Agent fees per year are the sum of `management_fees`, `letting_fees`, `lease_fees` and
  `sundry_fees`, reusing the existing `totalFees` helper.
- The year subtotal is the sum of `amount`, which is GROSS rent. Agent fees and
  `other_outgoings` never reduce it — they are deductions in their own right. The divider must not
  present a net figure.
- `other_outgoings` does not appear on the divider in any form. It is recorded for bank
  reconciliation only and is never a deduction.

### FR4 — Operating expenses: grouped rows and sticky dividers

- Expenses are grouped by `expense_date`.
- A divider row precedes each year's rows, showing the financial-year label, the count of expenses
  in that year, and the year's total `amount`.
- The subtotal uses `amount`, consistent with the existing lifetime `Total` row. GST is not
  deducted from the displayed figure.

### FR5 — Sticky behaviour

- A divider remains pinned to the top of the viewport while its own year's rows scroll past, and
  is displaced by the next year's divider.
- The divider has an opaque background so rows do not show through it while scrolling, and a
  stacking order above the row content.
- `components/rental-payments-section.tsx:456` wraps its table in `overflow-x-auto`. Because
  `overflow-x: auto` forces the computed `overflow-y` to `auto`, that wrapper is a scroll
  container in both axes, and a sticky row inside it anchors to the wrapper rather than the
  viewport — the wrapper is only as tall as its content, so the sticky would never visibly
  engage. The wrapper must be restructured so the sticky context is the page.
- If horizontal overflow is still required at narrow widths, the accepted fallback is to apply
  sticky positioning only at the breakpoint where the table fits without horizontal scrolling,
  leaving the divider as a plain non-sticky row on mobile. The divider itself must be present at
  every width.
- The dashboard shell has no sticky top bar, so the divider pins to `top-0` with no offset.

### FR6 — Existing behaviour preserved

- Section header lifetime figures are retained: "Rental payments · $48,600 gross rent · $2,916
  agent fees" and the Operating expenses lifetime `Total` row.
- The existing amber banners for unconfirmed statements and for payments flagged
  `NEEDS VERIFICATION` remain where they are, above the table.
- Add, edit, delete, statement upload, statement confirmation and invoice links are unchanged.
- Groups are derived from component state, so adding, editing or deleting a row re-groups
  immediately without a page reload — including when the change moves a row into a different
  financial year.
- Empty-state cards are unchanged; with no rows there are no dividers.
- A divider is rendered even when every row falls in a single financial year, because naming the
  year is the purpose of the control.

## Non-Functional Requirements

- **Accessibility:** the divider is a table row spanning the full column set, marked up as a
  header for the rows that follow it (`<th scope="colgroup">`), so a screen reader announces the
  year rather than reading a stray cell.
- **Responsive:** verified at mobile and desktop widths; the divider's contents must degrade
  gracefully at narrow widths rather than overflowing the card.
- **Theming:** the divider is legible in both light and dark themes, using existing semantic
  tokens rather than fixed colours.
- **Correctness of money:** all amounts are AUD via `formatCurrency`, with tabular numerals for
  aligned columns. Per-year subtotals must sum exactly to the lifetime total displayed in the
  same card.
- **No new dependencies.** No migration, no schema change, no RLS change.

## Acceptance Criteria

1. A property with payments spanning three financial years shows three dividers in Rental
   payments, newest year first, each naming the year and its payment count, agent fees and gross
   rent total.
2. The same property shows dividers in Operating expenses, newest year first, each naming the
   year, its expense count and its total.
3. Scrolling the Rent tab keeps the current year's divider pinned until the next year's divider
   replaces it.
4. A payment dated 30 June 2025 groups under 2024–25 and a payment dated 1 July 2025 groups under
   2025–26, with no timezone drift.
5. With `financial_year_start_month` set to a value other than 7, the dividers reflect that
   boundary, and a payment's year matches the year the tax pack assigns it.
6. The sum of every year's subtotal equals the lifetime total shown in the same card, for both
   sections.
7. Adding a payment dated in a financial year not previously present creates a new divider in the
   correct position without a reload.
8. Deleting the last row of a year removes that year's divider.
9. Tenancies (Rental periods) is visually unchanged.
10. `npm run build` and `CI=true npm test` both pass.
11. Both sections are legible in light and dark themes and at mobile width.

## Out of Scope

- Grouping the Rental periods / Tenancies section. A tenancy is a span that routinely straddles
  financial years, so assigning one to a single year would misrepresent it.
- Collapsing or expanding year groups, and any persistence of open/closed state.
- Filtering the tab to a single financial year, or a financial-year selector control.
- Making the column header row (`<thead>`) sticky.
- Net position per year (rent minus costs). The two sections remain independent; a combined net
  figure belongs to the tax pack.
- Any change to how rent, fees or outgoings are recorded, parsed or classified.
- Grouping any other tab, the financial dashboard, or the portfolio views.
- Schema, migration or RLS changes.
