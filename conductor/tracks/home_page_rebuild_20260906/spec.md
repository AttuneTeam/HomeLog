# Specification — Home page rebuild

## Overview

Replace the public landing page at `app/page.tsx` with a rebuild based on the Replit prototype's
editorial About-page design, adopting its copy verbatim and excluding "The People" section.

The prototype already uses this repository's type system — Libre Caslon Text for display and
Hanken Grotesk for body — and a palette in the same family as the current page. This is therefore a
**structural and palette change, not a new design language**. The work is transcription plus one
piece of genuine design: a dark theme the prototype does not provide.

**Reference prototype:** `/__mockup/preview/homebase-about/AboutPage`
(Replit host `57a68b69-6eda-42c0-af0e-6287ad6aa794-00-290g9syyfdenm.spock.replit.dev`)

## Section structure

| # | Section              | Anchor   | Background            |
|---|----------------------|----------|-----------------------|
| 1 | Nav (sticky)         | —        | paper `#fbf9f9`       |
| 2 | Hero                 | —        | paper                 |
| 3 | Why we exist         | `#story` | warm paper `#eee9df`  |
| 4 | The Nordic *húsbók*  | —        | paper                 |
| 5 | How Home Base works  | `#how`   | paper                 |
| 6 | Our principles       | —        | paper                 |
| 7 | Closing CTA          | `#start` | brass `#b89a5a`       |
| 8 | Footer               | —        | grey `#f5f3f3`        |

The prototype's `#team` section sits between 5 and 6 and is **excluded**, as is its
"Why it matters" band, which sat between the húsbók and "How Home Base works".

## Functional requirements

### FR1 — Navigation

Logo, then: "Our story" → `#story`, "How it works" → `#how`, "Log In" → `/login`,
"Get Started" → `/signup`.

- Sticky to the top; shrinks from 80px to 64px once scrolled past 20px.
- Mobile disclosure below the `md` breakpoint, keyboard operable.
- **The prototype's "The people" link is removed**, since its target section does not ship.

### FR2 — Hero

- Eyebrow: `About Home Base / 2021—present`
- H1: "A home is more than the sum of its rooms." — *sum* set in brass italic.
- Body: "It is the work you put into it. The decisions made quietly, over years. Home Base is a
  place to keep that story — clear, useful and ready for whoever comes next."
- Link: "Read our story ↓" → `#story`, with a rule beneath.
- Photograph, alt text "A Home Base property journal on a timber desk".
- Caption chip overlaid on the image: "The house book, reimagined".

### FR3 — Why we exist

Warm-paper band, `#story` anchor. Heading left, body right.

- Eyebrow: `Why we exist`
- Heading: "The handover should feel like a beginning, not an interrogation."
- Three paragraphs, verbatim:
  1. "We kept hearing the same story: a new owner arrives with a folder of invoices, a handful of
     half-remembered answers, and a long list of things they wish they had asked. Important
     knowledge disappears between owners."
  2. "Home Base began as a simple question: what if every property had a living record? Not a
     compliance file, but a generous, honest account of the care that has gone into it."
  3. "We built the tool we wanted to receive ourselves — a quiet place for the facts, the
     photographs and the little decisions that make a house a home."

### FR4 — The Nordic húsbók

- Eyebrow: `A tradition worth keeping`
- Heading: "The Nordic *húsbók*" — *húsbók* in italic, on its own line, with a short brass rule
  beneath.
- Lead: "In Scandinavia, a house book has long been part of the life of a well-kept home."
- Paragraph: "It holds the practical knowledge that otherwise lives in one person's head: when the
  roof was repaired, which paint is on the hallway walls, where the water shuts off. More than a
  ledger, it is an act of stewardship — a promise that the house will be understood and cared for."
- Paragraph: "We borrowed the idea, then made it useful for Australian homes. A digital house book
  that is as considered as the homes it records."

### FR5 — How Home Base works

`#how` anchor. Four numbered columns separated by hairline rules, stacking on mobile.

- Eyebrow: `How Home Base works`
- Heading: "One calm place for the life of your property."
- `01 Set the scene` — "Add your property, its history and the people who know it best."
- `02 Keep the record` — "Log maintenance, renovations and documents as life happens."
- `03 Build confidence` — "See what has been done, when, and by whom — at a glance."
- `04 Pass it on` — "Share a complete, useful record at sale or settlement."

### FR6 — Our principles

Accordion, three items, single-open, first open by default.

- Eyebrow: `Our principles`
- Heading: "The way we choose to work."
- `01 Care over convenience` — "A home is not a transaction. We make space for the small,
  important work of looking after one."
- `02 Clarity is kindness` — "Good records remove doubt. They let the next owner begin with
  confidence, not detective work."
- `03 Built to be passed on` — "The best things in a house outlast us. Home Base is made to
  travel, intact, through every chapter."

Requires a client component. Triggers carry `aria-expanded` and `aria-controls`; the open state is
signalled by a `+` / `−` affordance, not colour alone.

### FR7 — Closing CTA

Brass band, `#start` anchor.

- Eyebrow: `A better record starts here`
- Heading: "Give your home a story worth passing on."
- Button: "Start for free ↗" → `/signup`.

### FR8 — Footer

**Retains the existing page's `#f5f3f3` with a hairline top border, rather than the
prototype's ink band.** Logo, "A property's home passport. Made in Australia.",
"Founded 2021 / Sydney + Melbourne".

Because the footer is light in light theme and dark in dark theme — the same as paper —
it uses the paper-ground text tokens. The `*-on-slab` tokens serve the slab alone.

### FR9 — Hero asset

Extract `house-journal.jpg` from the prototype, commit it to `public/`, and serve it through
`next/image`. The page must make **no external image request at runtime** — the current page's
`images.unsplash.com` references do not survive this rebuild.

## Non-functional requirements

### NFR1 — Dark theme

The page must be legible in both themes via `next-themes`.

This is the one requirement the prototype gives no guidance on, and it is not a mechanical
inversion. **The layout's rhythm depends on bands that sit slightly below paper.** Rendered
naively on a dark ground those bands sink into an already-dark page and the composition flattens.

The dark palette must therefore re-establish that rhythm by inverting the *relationship* rather
than the colours: a band that sits below paper in light theme rises above it in dark, by the same
amount. Brass `#b89a5a` needs a lightened variant to hold contrast on dark ground, and the brass
CTA band needs a treatment that does not glare.

### NFR2 — Semantic tokens

Colours are defined as CSS custom properties with light and dark values, not the hardcoded hex
literals the current page uses throughout. NFR1 is not achievable without this. Tokens must be
scoped so they do not leak into dashboard surfaces.

### NFR3 — Contrast

Body text ≥ 4.5:1 and large display text ≥ 3:1, in both themes, on every band. Brass-on-paper and
brass-on-ink both verified and the measured ratios recorded.

### NFR4 — Responsive

Legible from 375px to 1440px and beyond. Display type scales down rather than overflowing; no
horizontal page scroll at any width.

### NFR5 — Motion

Preserve the existing fade-in-on-scroll behaviour driven by `IntersectionObserver`, gated behind
`prefers-reduced-motion`.

### NFR6 — Public route

`/` is already allowlisted in `lib/supabase/middleware.ts`. Confirm this is unchanged; the page
must remain reachable unauthenticated.

## Acceptance criteria

1. `npm run build` passes with no type errors.
2. All nine sections render in the specified order, with copy matching the prototype exactly.
3. No "The People" section and no "The people" nav link appear anywhere in the output.
4. No numeric statistic appears anywhere on the page, and no "Why it matters" band.
5. Nav CTAs reach `/login` and `/signup`; in-page anchors scroll to their sections.
6. The accordion is fully operable by keyboard, with correct ARIA state and a visible focus ring.
7. The page is legible in light **and** dark themes, confirmed visually in both.
8. No layout break or horizontal scroll at 375px.
9. The hero image is served from `public/`; no external image request is made.
10. No hardcoded colour literal remains in the landing components.

## Decisions

**The stats band is dropped.** The prototype's figures — 2,400+ properties, 87 suburbs,
4.8/5 handover confidence — are invented placeholder data. `product-guidelines.md` makes trust the
product's central design constraint, and the accountant channel described in `product.md` depends
on the product being credible to professionals. Publishing unverifiable social proof on the page
those professionals judge first is a poor trade for one band of visual interest. The band's
statement copy ships without the numbers.

**The prototype's copy ships verbatim, in its homeowner voice.** Chosen deliberately by the owner
over the alternative of re-angling toward the investor and tax positioning. Recorded so it reads
as a decision rather than an oversight: see *Known tension* below.

**The footer keeps the existing page's `#f5f3f3`, not the prototype's ink.** Requested by the
owner at the Phase 1 checkpoint. This leaves the "Why it matters" slab as the page's only dark
band, which sharpens rather than weakens it — the drama is no longer repeated at the bottom of
the page. The footer's separation comes from its hairline top border, as it does today.

**The "Why it matters" band is cut entirely.** Requested by the owner after Phase 3, having seen
it built. The band had already lost its statistics row; removing the statement too leaves the page
with no dark band at all, so paper carries most of it and the brass CTA becomes the only saturated
moment — a calmer composition than the prototype's. The consequence for NFR1 is that the dark
theme's inversion now rests on the warm band and footer alone, which still invert by the same
mechanism, just less dramatically. The four `*-on-slab` tokens it needed were removed with it
rather than left as dead colour.

**Full replacement rather than a merge.** The existing product-screenshot hero, dashboard preview
and logo band have no counterpart in the prototype and are not carried across. The prior page
remains in git history.

**Full dark-theme support** rather than treating the landing page as a committed light-only
surface. Chosen by the owner over the alternative of documenting an exemption from the workflow's
theme gate. This is the largest single piece of work in the track and the only part not specified
by the prototype.

## Known tension

The prototype's copy positions Home Base as a house book for homeowners — "a property's home
passport", "give your home a story worth passing on". It does not mention tax, the ATO, deductions,
or accountants.

`product.md` positions the product investor-first, names AI tax classification against ATO rulings
as *the* differentiator, and describes the accountant as the acquisition channel. The passport is
framed there as the retention mechanism, not the headline proposition.

The public page will therefore lead with a different promise than the product's stated strategy.
This was raised during planning and the owner elected to ship the prototype copy as written. It is
recorded here so a future reader does not mistake it for drift, and so it can be revisited as a
copy track without reopening the layout.

## Out of scope

- **"The People" section** and its two portraits — explicitly excluded by the request.
- **The stats band and the whole "Why it matters" section** — dropped by decision above.
- **Re-angling copy toward the investor and tax positioning** — see *Known tension*.
- Any change to authenticated dashboard surfaces.
- Any change to `/login`, `/signup`, the passport routes, or the `(story)` route group.
- Copy or layout for `/privacy` and `/terms`.
- Analytics, SEO metadata beyond what already exists, and Open Graph assets.
