# Track: Rental statement capture

**ID:** `rental_statement_capture_20260730`
**Type:** Feature
**Status:** New

Attach the managing agent's rental statement to a rent payment, and record the agency fees it
charges as actual figures rather than an estimate derived from `management_fee_pct`.

`rental_payments` is the only financial-evidence table with nowhere to store its document, so rent
is the one figure that reaches the tax pack without evidence. The larger cost is the agent-fee
line: a percentage model captures a recurring management fee and nothing else, missing $1,251.80
of letting fee, lease fee and bank charges on the reference statement — and presenting the result
with no disclosure that it is an estimate.

Third-party costs the agent paid stay out. They deduct via their own invoice, the only path that
classifies them correctly.

## Artifacts

-   [Specification](./spec.md)
-   [Implementation Plan](./plan.md)
-   [Metadata](./metadata.json)

## Project Context

-   [Project Index](../../index.md)
-   [Workflow](../../workflow.md)
