# Track: Rent tab financial-year grouping

**ID:** `rent_fy_grouping_20260907`
**Type:** Feature
**Status:** Complete — in review ([PR #40](https://github.com/AttuneTeam/HomeLog/pull/40))

Group rental payments and operating expenses on a property's Rent tab into financial-year
sections. Today each is a flat, date-sorted list, so a property held for several years is one
undifferentiated scroll and the only money figures on screen are whole-of-ownership totals.

The chosen layout keeps every row visible in one continuous list and injects a **sticky subtotal
divider** wherever the financial year changes. Nothing collapses and nothing is filtered away —
the year headings pin as you scroll past them. Payments dividers carry the year's payment count,
agent fees and gross rent; expenses dividers carry the count and total.

Grouping is by `payment_date` and `expense_date`, which is the ATO cash basis, so the Rent tab
agrees with the tax pack about which year a figure belongs to. The financial-year boundary is read
from `profiles.financial_year_start_month` / `_day` rather than hardcoded, for the same reason:
a user on a non-July year would otherwise see the two surfaces disagree.

Three things in this track are not obvious:

The grouping logic goes in a new pure module, `lib/tax/fy-grouping.ts`, and is unit-tested before
it is written. It derives each item's year by reusing `currentFyEndYear` from `lib/tax/fy.ts`
rather than introducing new calendar arithmetic, and parses dates as UTC — the local-time `Date`
constructor shifts the day backwards in Australian timezones and would file a 1 July payment under
the previous year.

Rows with a missing or unparseable date go into a trailing "Undated" group instead of being
dropped, because a dropped row would make the per-year subtotals fail to reconcile against the
lifetime total shown in the same card.

The real implementation risk is CSS, not logic. `components/rental-payments-section.tsx:456` wraps
its table in `overflow-x-auto`; `overflow-x: auto` forces the computed `overflow-y` to `auto`, so
that wrapper is a scroll container and a sticky row inside it anchors to the wrapper rather than
the viewport. The wrapper is only as tall as its content, so the divider would render perfectly
and simply never pin. Phase 2 isolates this as its own task and proves sticky works before the
divider is built on top of it.

Out of scope and deliberately so: the Tenancies section stays ungrouped, because a tenancy
routinely straddles financial years and assigning it to one would misrepresent it.

## Artifacts

-   [Specification](./spec.md)
-   [Implementation Plan](./plan.md)
-   [Metadata](./metadata.json)

## Project Context

-   [Project Index](../../index.md)
-   [Workflow](../../workflow.md)
