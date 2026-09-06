# Implementation Plan — Home page rebuild

**Track:** `home_page_rebuild_20260906`
**Spec:** [spec.md](./spec.md)

## Verification approach

This track is **Tier 3** under [`workflow.md`](../../workflow.md) — presentational components and
copy. The gate is `npm run build` passing plus visual confirmation in both light and dark themes.

No pure domain logic is added, so no unit tests are owed. `CI=true npm test` must still pass at
each phase checkpoint to confirm nothing existing regressed.

**Architectural note.** `app/page.tsx` is currently a single 697-line `"use client"` file, so the
entire landing page ships to the browser as a client bundle. This plan splits the sections into
`components/landing/`, leaving only the nav and the accordion as client components; everything else
renders on the server.

---

## Phase 1: Design foundations [checkpoint: 554bba7]

- [x] Task: Extract and commit the hero asset (a144613)
  - [x] Download `house-journal.jpg` from the prototype host
  - [x] Optimise and commit to `public/house-journal.jpg`
  - [x] Confirm intrinsic dimensions and aspect ratio suit the hero's `next/image` sizing

- [x] Task: Define the landing colour tokens (2611964)
  - [x] Add light-theme custom properties to `app/globals.css`: paper `#fbf9f9`,
        warm paper `#eee9df`, ink `#030813`, brass `#b89a5a`, brass-text `#775a19`,
        muted `#45474c`, hairline `#c6c6cc`
  - [x] Design the dark counterpart, inverting the band *relationship* so the "Why it matters"
        band reads as raised rather than darker against its neighbours (NFR1)
  - [x] Add a lightened brass variant that holds contrast on dark ground
  - [x] Scope the tokens so they do not leak into dashboard surfaces

- [x] Task: Verify contrast in both themes (5012678)
  - [x] Measure body text against every band; require ≥ 4.5:1
  - [x] Measure display type against every band; require ≥ 3:1
  - [x] Measure brass-on-paper and brass-on-ink in both themes
  - [x] Record the measured ratios in the task summary

- [x] Task: Phase Verification & Checkpoint (refer to `workflow.md`) (554bba7)

## Phase 2: Page shell [checkpoint: 7bc31c7]

- [x] Task: Build the navigation (7bc31c7)
  - [x] Create `components/landing/landing-nav.tsx` as a client component (scroll listener)
  - [x] Links: "Our story" → `#story`, "How it works" → `#how`, "Log In" → `/login`,
        "Get Started" → `/signup`
  - [x] Sticky positioning with an 80px → 64px shrink past 20px of scroll
  - [x] Mobile disclosure below `md`, keyboard operable with a visible focus state
  - [x] Confirm no "The people" link is present (AC3)

- [x] Task: Build the hero (7bc31c7)
  - [x] Create `components/landing/landing-hero.tsx` as a server component
  - [x] Eyebrow, H1 with brass italic *sum*, body copy, "Read our story ↓" per FR2
  - [x] Render the committed asset through `next/image` with the specified alt text
  - [x] Overlay the "The house book, reimagined" caption chip

- [x] Task: Build the footer (7bc31c7)
  - [x] Create `components/landing/landing-footer.tsx`
  - [x] Keep the existing `#f5f3f3` ground and hairline top border, not the prototype's ink
  - [x] Use the paper-ground text tokens (`fg`, `muted`, `brass-text`), not the `*-on-slab` set
  - [x] Logo, "A property's home passport. Made in Australia.",
        "Founded 2021 / Sydney + Melbourne"

- [x] Task: Compose the new page shell (7bc31c7)
  - [x] Rewrite `app/page.tsx` as a server component holding font wiring and composition
  - [x] Remove the superseded sections and the `images.unsplash.com` references
  - [x] Confirm `/` remains allowlisted in `lib/supabase/middleware.ts` (NFR6)

- [x] Task: Phase Verification & Checkpoint (refer to `workflow.md`) (7bc31c7)

## Phase 3: Narrative sections

- [x] Task: Build "Why we exist" (f70d094)
  - [x] Create `components/landing/landing-why.tsx` with the `#story` anchor
  - [x] Warm-paper band, heading left and three paragraphs right
  - [x] Transcribe all copy verbatim per FR3

- [x] Task: Build "The Nordic húsbók" (f70d094)
  - [x] Create `components/landing/landing-husbok.tsx`
  - [x] Heading with italic *húsbók* on its own line and a short brass rule beneath
  - [x] Lead sentence plus two paragraphs per FR4

- [x] ~~Task: Build "Why it matters"~~ — built in f70d094, then REMOVED at the owner's
      request after Phase 3. The section, its component and the four `*-on-slab` tokens
      are gone; see spec.md *Decisions*.

- [x] Task: Build "How Home Base works" (f70d094)
  - [x] Create `components/landing/landing-how.tsx` with the `#how` anchor
  - [x] Four numbered columns separated by hairline rules
  - [x] Stack to a single column on mobile without losing the numbering

- [ ] Task: Phase Verification & Checkpoint (refer to `workflow.md`)

## Phase 4: Interaction, theming and polish

- [ ] Task: Build the principles accordion
  - [ ] Create `components/landing/landing-principles.tsx` as a client component
  - [ ] Three items, single-open, first open by default
  - [ ] `aria-expanded` on triggers and `aria-controls` pointing at each panel
  - [ ] `+` / `−` affordance so open state is not signalled by colour alone
  - [ ] Verify keyboard-only operation and a visible focus ring (AC6)

- [ ] Task: Build the closing CTA
  - [ ] Create `components/landing/landing-cta.tsx` with the `#start` anchor
  - [ ] Brass band, "Start for free ↗" → `/signup`

- [ ] Task: Preserve the scroll reveal
  - [ ] Reinstate the `IntersectionObserver` fade-in across the new sections
  - [ ] Gate the animation behind `prefers-reduced-motion` (NFR5)

- [ ] Task: Dark-theme pass
  - [ ] Walk every section in dark theme and confirm the band rhythm survives (NFR1),
        now resting on the warm band and footer rather than the removed slab
  - [ ] Confirm no hardcoded colour literal remains in the landing components (AC10)

- [ ] Task: Responsive pass
  - [ ] Verify 375px, 768px, 1024px and 1440px
  - [ ] Confirm no horizontal page scroll and that display type scales (AC8)

- [ ] Task: Remove dead code
  - [ ] Delete superseded markup, unused imports and now-unreferenced helpers
  - [ ] Remove the Material Symbols stylesheet link if nothing references it
  - [ ] Remove `public/hero-screen.png` and `public/federation-house.jpg` only if unreferenced
        elsewhere in the repository

- [ ] Task: Phase Verification & Checkpoint (refer to `workflow.md`)
