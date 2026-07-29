# Product Guidelines — Home Base

These guidelines codify conventions already present in the product. When in doubt, look at
`components/tax-report.tsx`, `components/ai-tax-classification-panel.tsx`, and the property tab
pages — they are the reference implementations.

## Voice & tone

**Calm, precise, and never breathless.** Users are handling money and tax obligations. The product
should feel like a competent professional, not an enthusiastic app. No exclamation marks in
product copy, no celebratory language around financial events.

**Plain English over jargon, but never at the cost of accuracy.** Say "deductible now" rather than
"immediately deductible under s 25-10" in the interface — then cite the ruling where the detail
matters. Where a term of art is unavoidable (Division 43, cost base, ABN), use it correctly rather
than inventing a friendlier synonym that means something subtly different.

**Never state a tax position as certain when it isn't.** AI classifications are recommendations.
Copy uses "suggested", "likely", "review this" — not "your deduction is". Confidence scores and
citations are shown, not hidden.

**Australian English and Australian conventions.** "Organise", not "organize". Dates as
`DD Month YYYY`. Currency as AUD with the `en-AU` locale. Financial years written as `2025–26`
with an en dash.

## Writing rules

- Sentence case for headings and buttons — not Title Case.
- Buttons name the action performed: "Generate tax report", "Export to Xero", not "Submit" or "OK".
- Empty states explain what the section is for and how to populate it, rather than just saying
  "No data". Where a table is genuinely empty, an italic muted line naming the missing thing is
  the established pattern.
- Use an em dash (`—`) for a missing value in a table cell, never "N/A" or a blank.
- Error messages state what failed and what the user can do next. Never surface a raw exception.
- Destructive actions name the specific thing being destroyed and require explicit confirmation.

## Trust & disclosure

This is the product's most important design constraint. It is what keeps the accountant channel
open.

- **Every tax-facing output carries a disclaimer.** The generated tax report already does this and
  new financial outputs must follow. The product provides decision support; it does not give tax
  advice and does not lodge returns.
- **AI output is always attributable.** Show the sources retrieved, the confidence, and the
  reasoning. A classification the user cannot inspect is a classification they cannot defend to
  the ATO.
- **AI output is always overridable.** A manual classification wins over an AI one, and the
  interface makes it obvious which is in effect.
- **Distinguish computed estimates from recorded facts.** When a figure is derived (rent accrued
  from a weekly rate, interest projected from a rate schedule) rather than recorded (an actual
  payment, a bank statement), the interface must say so. Never let an estimate masquerade as a
  source document.
- **Sharing is opt-in and granular, and the user can always see who has access.** Revocation is
  always available and takes effect immediately.

## UX principles

**Show the position, then the evidence.** Summary figures come first; the transactions and
invoices that support them are one interaction away. Every number should be traceable to the
document behind it.

**Reduce data entry to review.** The ingestion pipelines (bulk upload, inbound email, invoice
extraction) exist so that the user's job is to confirm rather than to type. Prefer a staged review
queue over a blank form.

**Progressive disclosure.** Property detail lives in tabs; advanced financial modelling lives in
its own surface. The default view is the one a user needs most often, not the one with the most
information.

**Long-running work is honest about its state.** AI extraction and classification take real time.
Show progress, allow the user to navigate away, and never block the interface on a model call.

**Respect the financial year as the primary unit of time.** Financial reporting surfaces should
let the user choose the year rather than assuming the current one. The user's FY start is
configurable on their profile and must be honoured everywhere.

## Visual language

- shadcn components on `@base-ui/react` with Tailwind v4. Compose existing primitives in
  `components/ui/` before introducing a new dependency.
- `cn()` from `lib/utils.ts` merges classes. Semantic tokens (`muted-foreground`, `border`,
  `bg-muted/50`) over hardcoded colours, so light and dark themes both work.
- Currency and any aligned numeric column uses `tabular-nums`; amounts are right-aligned.
- Tables scroll inside their own container rather than forcing the page to scroll horizontally.
- Icons come from `lucide-react`, sized to match adjacent text.
- Feedback via `sonner` toasts — brief, and dismissible.

## Accessibility

- Never encode meaning in colour alone. A classification badge carries a label, not just a hue.
- All interactive elements are keyboard reachable with a visible focus state.
- Form inputs have associated labels; validation errors are announced, not merely coloured.
- Both light and dark themes must be legible — check contrast in both before shipping.
