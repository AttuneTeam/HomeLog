# Track: Home page rebuild

**ID:** `home_page_rebuild_20260906`
**Type:** Feature
**Status:** New

Replace the public landing page at `app/page.tsx` with a rebuild based on the Replit prototype's
editorial About-page design, adopting its copy verbatim and excluding "The People" section.

The prototype already uses this repository's type system — Libre Caslon Text for display, Hanken
Grotesk for body — and a palette in the same family as the current page. Most of the work is
transcription. Two things are not.

The prototype's stats band carries invented figures. It is dropped: `product-guidelines.md` makes
trust the central design constraint, and the accountants who are the acquisition channel are the
first people to read this page.

The dark theme is the real design work, because the prototype does not have one. The layout's
rhythm depends on alternating light and dark bands, so a naive inversion flattens it — the dark
palette has to invert the *relationship* between bands, not the colours.

Recorded and not fixed: the copy sells a house book for homeowners and never mentions tax, the ATO
or accountants, which `product.md` names as the differentiator. That is a deliberate choice, and it
can be revisited as a copy track without reopening the layout.

## Artifacts

-   [Specification](./spec.md)
-   [Implementation Plan](./plan.md)
-   [Metadata](./metadata.json)

## Project Context

-   [Project Index](../../index.md)
-   [Workflow](../../workflow.md)
