# Project Workflow — Home Base

> **Customised for this repository.** The standard Conductor workflow assumes a configured test
> runner and mandates strict TDD. Home Base currently has **no test framework and no linter** —
> `npm run build` (tsc) is the only automated gate. This workflow reflects that reality rather
> than prescribing a step that cannot be executed, and defines the path to full TDD as the target
> state.

## Guiding Principles

1.  **The Plan is the Source of Truth:** All work must be tracked in `plan.md`.
2.  **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in
    `tech-stack.md` *before* implementation.
3.  **Verification scales with risk:** Not all code carries the same risk. See
    *Verification Tiers* below. Domain math, RLS policies, deletion logic and tax classification
    demand more evidence than a layout change.
4.  **Test coverage grows monotonically:** New pure domain logic in `lib/` ships with tests once a
    runner exists. Coverage never goes backwards. Target state is >80% on `lib/`.
5.  **User Experience First:** Every decision should prioritise user experience.
6.  **Trust is a feature:** Financial and AI-facing output must stay attributable, overridable,
    and honest about estimate-vs-fact, per `product-guidelines.md`.
7.  **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use `CI=true` for watch-mode
    tools to ensure single execution.

## Verification Tiers

Determine the tier before starting a task; it sets what "done" requires.

**Tier 1 — Domain logic & security.** `lib/finance-utils.ts`, `lib/tax-utils.ts`,
`lib/stamp-duty.ts`, `lib/ai/*`, RLS policies, migrations, deletion logic, auth and sharing.
- Requires: unit tests where a runner exists (write them first — Red/Green); otherwise a
  documented manual verification against a local Supabase instance with the exact commands and
  observed output recorded in the task summary.
- RLS changes additionally require verifying access **is denied** for a non-owner, not only that
  it is allowed for the owner.
- Migration changes require `npm run db:reset` to confirm a clean replay from scratch.

**Tier 2 — Server Actions, API routes, data flow.** Requires `npm run build` passing plus manual
exercise of the happy path and at least one failure path.

**Tier 3 — Presentational components & copy.** Requires `npm run build` passing plus visual
confirmation in both light and dark themes.

## Task Workflow

### Standard Task Workflow

1.  **Select Task:** Choose the next available task from `plan.md` in sequential order.

2.  **Mark In Progress:** Edit `plan.md` and change the task from `[ ]` to `[~]`.

3.  **Determine Tier & Plan Verification:** State the verification tier and how the task will be
    proven correct *before* writing code. For Tier 1 with a test runner available, write the
    failing tests now and confirm they fail.

4.  **Implement:**
    - Follow `code_styleguides/` — including the Home Base project overrides.
    - For Tier 1 work with tests, write the minimum code to go green.
    - Keep domain math in `lib/`, out of components, so it stays testable.

5.  **Verify:**
    - **Always run `npm run build`.** This is the type-check and the baseline gate. It must pass.
    - Execute the tier-appropriate verification from step 3.
    - If tests exist, run them and confirm they pass.

6.  **Refactor (Recommended):** With verification in place, improve clarity and remove
    duplication without changing behaviour. Re-verify.

7.  **Document Deviations:** If the implementation differs from the documented tech stack:
    - **STOP** implementation.
    - Update `tech-stack.md` with the new design and a dated note explaining the change.
    - Resume implementation.

8.  **Commit Code Changes:**
    - Stage the changes related to the task.
    - Propose a clear commit message, e.g. `feat(tax): Add FY selector to tax report`.
    - Perform the commit.

9.  **Attach Task Summary with Git Notes:**
    - **9.1** Get the commit hash: `git log -1 --format="%H"`.
    - **9.2** Draft a summary: task name, what changed, files created/modified, the core *why*,
      and **the verification actually performed** (commands run and observed results).
    - **9.3** Attach it: `git notes add -m "<note content>" <commit_hash>`.

10. **Record Task Commit SHA:**
    - Read `plan.md`, change the task from `[~]` to `[x]`, and append the first 7 characters of
      the commit hash.
    - Write `plan.md` back.

11. **Commit Plan Update:** Stage `plan.md` and commit, e.g.
    `conductor(plan): Mark task 'Add FY selector' as complete`.

### Task Correction & Plan Amendment Workflows

1.  **In-Flight Refinements:** If minor gaps are found while a task is active (`[~]`), adjust
    directly in the implementation stream and re-verify before committing.
2.  **Code Review Corrections (`conductor-review`):** Ask the agent to run a review. It appends a
    `Review Fixes` phase to `plan.md` so corrections are formally tracked.
3.  **Logical State Reversions (`conductor-revert`):** If an implementation is fundamentally
    flawed, ask the agent to revert. This rolls back the commits and resets the task to `[ ]`.

## Phase Completion Verification and Checkpointing Protocol

**Trigger:** Executed immediately after a task completes that also concludes a phase in `plan.md`.

1.  **Announce Protocol Start:** Inform the user the phase is complete and verification has begun.

2.  **Determine Phase Scope:**
    - Read `plan.md` for the previous phase's checkpoint SHA. If none exists, scope is all
      changes since the first commit.
    - Run `git diff --name-only <previous_checkpoint_sha> HEAD` for the changed file list.

3.  **Assess Verification Debt:**
    - Exclude non-code files (`.json`, `.md`, `.yaml`).
    - For each remaining code file, identify its tier. **List any Tier 1 file changed in this
      phase that lacks automated test coverage.** Where a test runner exists, write the missing
      tests now, matching the repository's existing naming and style conventions.
    - Where no runner exists, record the gap explicitly in the checkpoint note. Verification debt
      is tracked, never silently skipped.

4.  **Execute Automated Checks:**
    - Announce the exact command before running it.
    - **Baseline:** `npm run build` — must pass.
    - **If a test runner is configured:** announce and run it (e.g. `CI=true npm test`).
    - If checks fail, inform the user and debug. Propose a fix a **maximum of two times**; if it
      still fails, stop, report the persistent failure, and ask for guidance.

5.  **Propose a Manual Verification Plan:**
    - Analyse `product.md`, `product-guidelines.md` and `plan.md` to determine the phase's
      user-facing goals.
    - Produce step-by-step instructions with commands and specific expected outcomes. Example:

        ```
        The build passed. For manual verification, please follow these steps:

        **Manual Verification Steps:**
        1. **Start the development server:** `npm run dev`
        2. **Open:** `http://localhost:3000/properties`
        3. **Confirm:** The tax report page offers a financial-year selector, and choosing
           2025–26 returns figures for that year rather than the current one.
        ```

6.  **Await Explicit User Feedback:** Ask: "**Does this meet your expectations? Please confirm
    with yes or provide feedback on what needs to be changed.**" **PAUSE** and wait for an
    explicit confirmation.

7.  **Identify Target Commit:** Do NOT create an empty commit. Use the hash of the last functional
    commit in the phase.

8.  **Attach Verification Report via Git Notes:** Draft a report covering the automated commands
    run, the manual steps, any recorded verification debt, and the user's confirmation. Attach it
    with `git notes` to the commit from step 7.

9.  **Record Phase Checkpoint SHA:** Append `[checkpoint: <sha>]` to the phase heading in
    `plan.md` and write it back.

10. **Commit Plan Update:** `conductor(plan): Mark phase '<PHASE NAME>' as complete`.

11. **Announce Completion.**

## Quality Gates

Before marking any task complete:

- [ ] `npm run build` passes with no type errors
- [ ] Tier-appropriate verification performed and recorded in the git note
- [ ] Tier 1 changes have tests, or the gap is explicitly recorded as verification debt
- [ ] Code follows `code_styleguides/`, including the Home Base project overrides
- [ ] Exported functions and non-obvious logic are documented; tax logic names the ATO rule it
      encodes
- [ ] No `any`; no type assertions used to paper over stale `database.types.ts`
- [ ] `database.types.ts` updated by hand if a table or column changed
- [ ] New public routes added to the allowlist in `lib/supabase/middleware.ts`
- [ ] RLS policy added or reviewed for any new table
- [ ] Responsive layout verified; light and dark themes both legible
- [ ] No secrets committed; no server-only env var prefixed `NEXT_PUBLIC_`
- [ ] Documentation updated if needed

## Development Commands

### Setup

```bash
npm install
supabase start          # local Postgres at 127.0.0.1:54322
npm run db:migrate      # apply pending migrations
npm run seed:ato        # embed the ATO rulings corpus (needed for classification)
npm run seed:demo       # optional: demo property with renovations/expenses
```

### Daily Development

```bash
npm run dev             # dev server at localhost:3000
npm run build           # production build + type check — THE correctness gate
npm run db:migrate      # apply new migrations
npm run db:reset        # wipe + replay all migrations from scratch
npm run db:sync         # copy prod DB rows + storage into local
```

### Before Committing

```bash
npm run build           # must pass
# npm test              # once a test runner is configured
```

## Testing Requirements

### Current state

No test framework is installed. Until one is, Tier 1 changes require documented manual
verification against a local Supabase instance, captured in the task's git note.

### Target state

Introduce a runner (Vitest is the natural fit for this Vite-free Next + TS stack) and build
coverage outward from the highest-risk, easiest-to-test code:

1. **`lib/` domain math first** — `finance-utils`, `tax-utils`, `stamp-duty`. Pure functions,
   no I/O, highest consequence if wrong. This is where >80% coverage matters most.
2. **Classification schema and parsers** — `lib/ai/classification-schema.ts`,
   `lib/email-parser/`. Deterministic given fixed input; use recorded fixtures rather than live
   model calls.
3. **RLS policies** — integration tests against a local database asserting that a non-owner is
   *denied*, per property, share and passport path.
4. **Server Actions and API routes** — happy path plus auth-failure path.

### Rules once a runner exists

- Every new module in `lib/` ships with tests.
- Mock external dependencies. **Never call Anthropic, OpenAI, Tavily, Xero or Resend from a
  test** — use fixtures.
- Test both success and failure cases.
- Deletion logic changes must run `npm run verify:deletion`.

## Code Review Process

### Self-Review Checklist

1.  **Functionality** — works as specified, edge cases handled, error messages user-friendly.
2.  **Code Quality** — follows the style guide and overrides, DRY, clear names, comments explain
    *why*.
3.  **Verification** — tier-appropriate evidence exists and is recorded.
4.  **Security** — no hardcoded secrets; input validated with zod; RLS in place for new tables;
    `createAdminClient` used only where justified; signed URLs for private storage.
5.  **Correctness of money** — amounts are AUD; financial-year boundaries respect the user's
    configured FY start; estimates are visibly distinguished from recorded facts.
6.  **Performance** — database queries batched where possible (`Promise.all`); no N+1 signed-URL
    generation in a loop where a batch will do.
7.  **Responsive** — touch targets adequate, text readable without zooming, tables scroll within
    their container rather than the page.

## Commit Guidelines

### Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Examples

```bash
git commit -m "feat(tax): Add financial-year selector to tax report"
git commit -m "fix(roi): Query roi_calculator_inputs by property_id, not user_id"
git commit -m "chore(db): Add migration 054 for property FY facts"
```

## Definition of Done

A task is complete when:

1.  Code implemented to specification.
2.  `npm run build` passes.
3.  Tier-appropriate verification performed, and any gap recorded as verification debt.
4.  Tests written and passing where a runner exists.
5.  Documentation updated if applicable.
6.  Responsive and theme-legible where user-facing.
7.  Changes committed with a proper message.
8.  Git note with task summary and verification evidence attached to the commit.
9.  `plan.md` updated with status and commit SHA.

## Emergency Procedures

### Critical Bug in Production

1.  Create a hotfix branch from `main`.
2.  Reproduce the bug and capture the reproduction.
3.  Implement the minimal fix.
4.  Verify — including that the reproduction no longer occurs.
5.  Deploy.
6.  Document in `plan.md` and add a regression test once a runner exists.

### Data Loss

1.  Stop write operations.
2.  Restore from the latest Supabase backup.
3.  Verify data integrity, including storage objects, not only table rows.
4.  Document the incident and update backup procedures.

### Security Breach

1.  Rotate all secrets immediately — Supabase service-role key, `XERO_PKCE_COOKIE_SECRET`,
    Anthropic, OpenAI, Tavily and Resend keys.
2.  Review Supabase auth and access logs.
3.  Patch the vulnerability; audit RLS policies for the affected tables.
4.  Notify affected users. Given the product holds financial records, assess Australian
    notifiable-data-breach obligations.
5.  Document and update procedures.

## Deployment Workflow

### Pre-Deployment Checklist

- [ ] `npm run build` passes
- [ ] Tests pass, where they exist
- [ ] `npm run db:reset` replays migrations cleanly from scratch
- [ ] Environment variables configured in the deployment target
- [ ] New public routes allowlisted in `lib/supabase/middleware.ts`
- [ ] Database migrations reviewed and ready

### Deployment Steps

1.  Merge the feature branch to `main`.
2.  Run database migrations against production **before** the code that depends on them goes live.
3.  Deploy.
4.  Verify critical paths: login, property list, expense upload, AI classification, tax report.
5.  Monitor for errors.

### Post-Deployment

1.  Check error logs.
2.  Gather user feedback.
3.  Plan the next iteration.

## Continuous Improvement

- Review this workflow when it causes friction rather than preventing mistakes.
- Retire the "no test runner" accommodations as soon as a runner lands — this document should
  become stricter over time, not looser.
- Document lessons learned.
- Keep things simple and maintainable.
