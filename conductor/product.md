# Product Definition — Home Base

## Vision

Home Base is a property-investment platform for Australian investors that turns the painful,
high-stakes admin of tax time into a living record of every property they own.

It tracks properties, renovations, expenses, loans and rental income, and uses AI grounded in real
ATO rulings (RAG over TR 97/23, TR 2021/5 and others) to classify renovation spend as deductible,
capital works, or depreciable — the ambiguous call accountants hate making by hand. Deep Xero
integration posts the result as multi-line journals with per-property tracking.

Strategically, the product is not a SaaS subscription business. Accountants onboard their investor
clients for free because the tool saves them hours at tax time, making them a zero-cost acquisition
channel. Investors stay for the **property passport** — a transferable, tokenised record of a
property's full renovation history, cost base and tax position. That engaged, deeply-contextualised
investor base is the asset a future marketplace monetises, routing high-intent renovation and
transaction signals to the contractors and agents who want them.

> A marketplace wearing a tax tool's clothes.

## The problem

Australia has roughly 2.2M property investors. Their financial admin is painful and high-stakes:

- Classifying renovation spend against ATO rules (deductible vs capital works vs depreciable) is
  genuinely ambiguous, and getting it wrong is expensive.
- Expenses, invoices, rental statements and loan documents scatter across email, storage and
  paper across multiple properties and multiple years.
- Getting all of it into the accountant's system at tax time is manual, repetitive work on both
  sides of the relationship.

Existing tools sell subscriptions into a fragmented, low-margin SaaS race. Meanwhile the businesses
that want these investors — contractors chasing renovation work, buyers agents chasing the next
purchase, agents chasing the next listing — pay heavily for cold, context-free leads. Nobody
connects the two.

## Users

**Primary — the property investor.** Owns one or more Australian investment properties, possibly
alongside a primary residence. Wants to know their real position, keep evidence organised, and hand
their accountant a clean package at tax time without assembling it by hand.

**Channel — the accountant / broker.** Not the paying customer; the distribution. Onboards their
investor clients because the tool saves them real hours. Needs a roster view across clients and a
bulk export that drops into their workflow. Access arrives through the sharing model, not a
separate product.

**Future demand side — contractors, buyers agents, agents.** Pay for scoped, context-rich intent
rather than cold form-fills. Not yet built.

## Core capabilities

**Property & portfolio tracking.** Properties (investment or primary residence) with purchase
price, stamp duty across all eight Australian jurisdictions, loans, interest-rate history, offset
accounts, and AI-enriched history (year built, architectural style, heritage status, sale history).

**Renovation & expense management.** Renovations with status and classification; expenses with
supplier, ABN, GST, category and attached invoices. Contractors are tracked per-account and
globally.

**AI tax classification (the differentiator).** A two-step RAG pipeline: extract text from the
invoice (`pdf-parse` for PDFs, Claude Vision for images), chunk and embed it, then run cosine
similarity against an embedded ATO rulings corpus and classify with Claude against a Zod schema.
Output carries citations and a confidence score, and is always reviewable and overridable by a
human.

**Rental income & operating expenses.** Tenancy periods with management fees, actual rental
payments ingested from agent emails via an inbound webhook, and operating expenses categorised to
map onto ATO rental schedule lines.

**Reporting & handoff.** Per-property tax reports as PDF and XLSX, CGT cost base calculation, and
one-click Xero journal posting.

**Sharing & the property passport.** Account-level and property-level sharing with RLS-enforced
isolation, plus tokenised public passport links — a read-only, transferable record of a property's
story.

**Ingestion.** Bulk receipt upload and inbound email parsing feed a staged review queue, so
evidence lands in the system without manual data entry.

## Strategic direction

The build sequence is deliberately staged so each phase validates the assumption the next one
depends on.

**Phase 0 — Activate the accountant channel.** A roster view across clients and a bulk FY tax-pack
export, so the tool saves accountants real hours and they push it to their book. This is the
current focus.

**Phase 1 — Monetise renovations, plus a light community layer.** Renovations are the densest,
most frequent intent signal. Investors request quotes; contractors pay for context-rich leads.
Ships alongside discoverable passports and contractor attribution, because peer trust lifts lead
conversion and gives investors a reason to return between intent events.

**Phase 2 — Own the transaction and the home-log marketplace.** Passport-as-listing-dossier for
agents and conveyancers; buyers-agent introductions on portfolio growth; investors buy or unlock
comparable home logs for a fee shared with the original owner.

## Principles & non-goals

**Decision support, never automated filing.** AI classification is positioned as a
recommendation the investor or their accountant reviews. Every AI output is inspectable, cites its
sources, and can be manually overridden. The product does not lodge returns and does not give tax
advice.

**Monetisation is investor-initiated and opt-in.** The investor pulls quotes; we never push their
identity. This is the line between a valued feature and a data broker, and it is what keeps the
accountant channel open.

**Sharing is granular and opt-in.** Privacy is the gate, not an afterthought. Investors can share
the story, materials and contractors with cost ranges without exposing exact figures or identity.

**Data isolation is enforced in the database.** Row Level Security, not application code, is the
boundary. Application-level checks are defence in depth, never the primary control.

**Not a greenfield social network.** The community layer is the engagement layer of the existing
product, seeded by passports that already exist — not a second product competing for attention.

**Australian-specific by design.** All amounts are AUD; tax logic targets the ATO and the
Australian financial-year model. Internationalisation is explicitly out of scope.

## What success looks like

- An accountant can onboard a client and export a complete, correct FY tax pack without manual
  assembly.
- An investor's renovation spend is classified with citations they and their accountant trust.
- The property passport is complete enough that it carries real value at handover when a property
  changes hands.
- Investors per accountant, and intent events per investor per year, are measured rather than
  assumed.
