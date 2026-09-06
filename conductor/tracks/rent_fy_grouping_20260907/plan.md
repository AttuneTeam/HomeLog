# Plan — Financial-year grouping on the Rent tab

Verification tiers per `conductor/workflow.md`. Phase order avoids a broken intermediate state:
the pure module lands first and fully tested, then the plumbing arrives with its first consumer,
then the second consumer reuses what the first extracted.

---

## Phase 1 — Financial-year grouping module (Tier 1)

Pure domain logic with no I/O. Tests are written first and confirmed failing before any
implementation, per the Tier 1 rule.

- [x] **Task: Write failing tests for `lib/tax/fy-grouping.ts`** `476e929`
  - [ ] Create `tests/lib/tax/fy-grouping.test.ts`, mirroring the source path and matching the
        conventions in the neighbouring `tests/lib/tax/fy.test.ts`.
  - [ ] Empty input returns an empty array.
  - [ ] A single item returns one group carrying the correct `fyEndYear` and `label`.
  - [ ] Boundary: an item dated `2025-06-30` groups under `fyEndYear` 2025; one dated
        `2025-07-01` groups under 2026.
  - [ ] Items across three financial years return three groups ordered newest first.
  - [ ] Item order within a group is exactly the caller's order — assert with deliberately
        unsorted input, proving the module neither sorts nor assumes sorted input.
  - [ ] A non-July financial-year start (e.g. month 4) shifts the boundaries accordingly.
  - [ ] A calendar-year start (1 January) produces single-year labels.
  - [ ] An item dated `2024-02-29` groups correctly, confirming no fixed-month-length assumption.
  - [ ] Null, undefined and malformed dates collect into a single trailing "Undated" group and
        are never dropped.
  - [ ] The "Undated" group sorts last even when dated groups are present.
  - [ ] Timezone: assert grouping is stable with the process timezone set to
        `Australia/Sydney`, proving the UTC parsing requirement rather than assuming it.
  - [ ] Run `CI=true npm test` and confirm the new tests FAIL for the right reason.

- [x] **Task: Implement `lib/tax/fy-grouping.ts`** `476e929`
  - [ ] Define the exported group type (`fyEndYear`, `label`, `items`) and the generic grouping
        function taking items, a date accessor and the FY start month/day.
  - [ ] Derive each item's financial year by reusing `currentFyEndYear` from `lib/tax/fy.ts`;
        introduce no new calendar arithmetic.
  - [ ] Parse dates as UTC via `${date}T00:00:00Z`, and document why in a comment referencing the
        UTC rationale at the top of `fy.ts`.
  - [ ] Label groups with `formatFyLabel`, passing the caller's FY start through.
  - [ ] Route missing and unparseable dates to the trailing "Undated" group.
  - [ ] Document the exported function, stating that input order is preserved within a group and
        why nothing is ever dropped.
  - [ ] Run `CI=true npm test` — all tests green.
  - [ ] Run `npm run build` — must pass.

- [ ] **Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)**

---

## Phase 2 — FY start plumbing and Rental payments grouping (Tier 2 + Tier 3)

The profile read is Tier 2 (data flow); the table changes are Tier 3.

- [ ] **Task: Read the financial-year start from the user's profile on the Rent tab**
  - [ ] In `app/(dashboard)/properties/[propertyId]/(tabs)/rent/page.tsx`, add the `profiles`
        select for `financial_year_start_month` and `financial_year_start_day` to the existing
        `Promise.all`, not as a serial round trip.
  - [ ] Fall back to `AU_FY_START_MONTH` / `AU_FY_START_DAY`, matching
        `app/(dashboard)/properties/[propertyId]/tax-pack/page.tsx:116`.
  - [ ] Pass both values to `RentalPaymentsSection`.
  - [ ] Verify the happy path (profile present) and the failure path (no profile row — defaults
        apply, page still renders).
  - [ ] `npm run build` must pass.

- [ ] **Task: Resolve the sticky/overflow conflict in the payments table**
  - [ ] Restructure the `overflow-x-auto` wrapper at
        `components/rental-payments-section.tsx:456` so the sticky context is the page rather
        than the wrapper.
  - [ ] Confirm by scrolling that a sticky row actually pins, before building the divider on top
        of it.
  - [ ] If horizontal scrolling proves necessary at narrow widths, apply the documented fallback:
        sticky only at the breakpoint where the table fits, with the divider still rendered as a
        plain row on mobile.
  - [ ] Record which resolution was taken and why in the task's git note — this is the one
        non-obvious constraint in the track.

- [ ] **Task: Build the shared sticky FY divider row**
  - [ ] Extract a presentational divider component rendering a full-width table row, so Phase 3
        reuses it rather than duplicating the markup.
  - [ ] Mark it up as `<th scope="colgroup">` spanning the column set, so a screen reader
        announces the year.
  - [ ] Give it an opaque background and a stacking order above row content, using semantic
        tokens so it holds up in both themes.
  - [ ] Accept the label plus a slot for section-specific figures, since payments carry fees and
        expenses do not.

- [ ] **Task: Group rental payments by financial year with sticky dividers**
  - [ ] Derive groups with `useMemo` over component state, so add, edit and delete re-group
        without a reload — including when a change moves a row into another financial year.
  - [ ] Group by `payment_date`.
  - [ ] Render a divider per year showing the FY label, payment count, agent fees (only when
        above zero, via the existing `totalFees` helper) and gross rent for the year.
  - [ ] Subtotal `amount` as GROSS rent. Do not subtract fees, and do not surface
        `other_outgoings` on the divider in any form.
  - [ ] Retain the lifetime header figures and both amber banners exactly as they are.
  - [ ] Confirm per-year subtotals sum exactly to the lifetime header total.
  - [ ] `npm run build` must pass; visually confirm in light and dark themes and at mobile width.

- [ ] **Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)**

---

## Phase 3 — Operating expenses grouping (Tier 3)

- [ ] **Task: Group operating expenses by financial year with sticky dividers**
  - [ ] Pass the FY start month/day from the Rent tab page to `RentalExpensesSection`.
  - [ ] Derive groups with `useMemo` over component state, grouping by `expense_date`, and keep
        the existing date-descending sort as the input order.
  - [ ] Reuse the divider component from Phase 2; render the FY label, expense count and the
        year's total `amount`.
  - [ ] Do not deduct GST from the displayed subtotal, consistent with the existing `Total` row.
  - [ ] Retain the lifetime `Total` row.
  - [ ] Confirm per-year subtotals sum exactly to that `Total`.
  - [ ] Confirm a divider still renders when every expense falls in a single financial year.
  - [ ] `npm run build` must pass; visually confirm in light and dark themes and at mobile width.

- [ ] **Task: Verify the acceptance criteria end to end**
  - [ ] Walk every acceptance criterion in `spec.md` against a property with multi-year history,
        recording the observed result for each.
  - [ ] Confirm criterion 5 specifically by temporarily setting a non-July
        `financial_year_start_month` and checking the Rent tab agrees with the tax pack.
  - [ ] Confirm criteria 7 and 8 by adding a payment in a new financial year and deleting the
        last row of a year.
  - [ ] Confirm Tenancies is visually unchanged.
  - [ ] Run `npm run build` and `CI=true npm test`.

- [ ] **Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)**
