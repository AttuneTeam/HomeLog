# Google TypeScript Style Guide Summary

This document summarizes key rules and best practices from the Google TypeScript
Style Guide, which is enforced by the `gts` tool.

## 1. Language Features

-   **Variable Declarations:** Always use `const` or `let`. **`var` is
    forbidden.** Use `const` by default.
-   **Modules:** Use ES6 modules (`import`/`export`). **Do not use
    `namespace`.**
-   **Exports:** Use named exports (`export {MyClass};`). **Do not use default
    exports.**
-   **Classes:**
    -   **Do not use `#private` fields.** Use TypeScript's `private` visibility
        modifier.
    -   Mark properties never reassigned outside the constructor with
        `readonly`.
    -   **Never use the `public` modifier** (it's the default). Restrict
        visibility with `private` or `protected` where possible.
-   **Functions:** Prefer function declarations for named functions. Use arrow
    functions for anonymous functions/callbacks.
-   **String Literals:** Use single quotes (`'`). Use template literals (`` `
    ``) for interpolation and multi-line strings.
-   **Equality Checks:** Always use triple equals (`===`) and not equals
    (`!==`).
-   **Type Assertions:** **Avoid type assertions (`x as SomeType`) and
    non-nullability assertions (`y!`)**. If you must use them, provide a clear
    justification.

## 2. Disallowed Features

-   **`any` Type:** **Avoid `any`**. Prefer `unknown` or a more specific type.
-   **Wrapper Objects:** Do not instantiate `String`, `Boolean`, or `Number`
    wrapper classes.
-   **Automatic Semicolon Insertion (ASI):** Do not rely on it. **Explicitly end
    all statements with a semicolon.**
-   **`const enum`:** Do not use `const enum`. Use plain `enum` instead.
-   **`eval()` and `Function(...string)`:** Forbidden.

## 3. Naming

-   **`UpperCamelCase`:** For classes, interfaces, types, enums, and decorators.
-   **`lowerCamelCase`:** For variables, parameters, functions, methods, and
    properties.
-   **`CONSTANT_CASE`:** For global constant values, including enum values.
-   **`_` Prefix/Suffix:** **Do not use `_` as a prefix or suffix** for
    identifiers, including for private properties.

## 4. Type System

-   **Type Inference:** Rely on type inference for simple, obvious types. Be
    explicit for complex types.
-   **`undefined` and `null`:** Both are supported. Be consistent within your
    project.
-   **Optional vs. `|undefined`:** Prefer optional parameters and fields (`?`)
    over adding `|undefined` to the type.
-   **`Array<T>` Type:** Use `T[]` for simple types. Use `Array<T>` for more
    complex union types (e.g., `Array<string | number>`).
-   **`{}` Type:** **Do not use `{}`**. Prefer `unknown`, `Record<string,
    unknown>`, or `object`.

## 5. Comments and Documentation

-   **JSDoc:** Use `/** JSDoc */` for documentation, `//` for implementation
    comments.
-   **Redundancy:** **Do not declare types in `@param` or `@return` blocks**
    (e.g., `/** @param {string} user */`). This is redundant in TypeScript.
-   **Add Information:** Comments must add information, not just restate the
    code.

*Source:
[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)*

---

# Project Overrides — Home Base

The guide above is Google's. Where it conflicts with this codebase or with framework
requirements, **the rules below win.** Each override states why, so it can be revisited.

## Formatting

- **Use double quotes (`"`)**, not single. This is the existing convention throughout
  (`"use client"`, `from "@/lib/supabase/server"`). Consistency with the existing 176 source
  files matters more than the guide's preference.
- Semicolons are required, per the guide.

## Modules & exports

- **Default exports are required for Next.js route files** — `page.tsx`, `layout.tsx`,
  `route.ts`, `error.tsx`, `not-found.tsx`, and `proxy.ts`. The App Router resolves these by
  default export; the guide's blanket ban is structurally incompatible with the framework.
- **Named exports elsewhere.** Shared components, hooks and `lib/` utilities use named exports.
- Import via the `@/*` path alias rather than relative traversal (`@/lib/utils`, not
  `../../lib/utils`).

## Naming

- **React components are `UpperCamelCase`**, both the function and its file's exported symbol.
  Component files are `kebab-case.tsx` (`tax-report.tsx` exports `TaxReport`).
- Server Actions and utility functions are `lowerCamelCase`.
- Database columns are `snake_case` and appear as such in TypeScript — do not camel-case them at
  the query boundary. The row shape mirrors Postgres exactly.
- Migration files are `NNN_snake_case_description.sql`, sequentially numbered.

## Types

- `any` remains forbidden; prefer `unknown` and narrow.
- **Type assertions are a warning sign around Supabase queries.** Casting a query result to
  silence a type error usually means `lib/supabase/database.types.ts` is stale, not that the cast
  is correct. Update the hand-maintained types instead. A column that type-checks is not proof
  the column exists in the database.
- Zod schemas are the source of truth for AI structured output; derive TypeScript types from them
  with `z.infer` rather than declaring both separately.

## React & Next.js

- Server Components are the default. Add `"use client"` only when the component needs state,
  effects, browser APIs, or event handlers.
- Dynamic route params are Promises in Next 16 — type as `{ params: Promise<{ id: string }> }`
  and `await params`.
- Mutations belong in Server Actions (`app/actions/*.ts`); AI pipelines, webhooks, OAuth and
  streaming belong in API routes.
- Compose existing `components/ui/` primitives before adding a UI dependency. Merge classes with
  `cn()`.

## Data access & security

- Use `createClient` (RLS-scoped) by default. `createAdminClient` bypasses RLS and is restricted
  to webhooks and system tasks — every use needs a justification in a comment.
- Every Server Action and API route calls `supabase.auth.getUser()` and bails when there is no
  user. This is defence in depth; **RLS is the actual boundary.**
- Never edit an applied migration. Add a new sequentially-numbered file.
- No secrets in source. Server-only environment variables must never be prefixed
  `NEXT_PUBLIC_`.

## Comments

- Per the guide, comments explain *why*, not *what*. In this codebase that applies especially to
  tax logic: a calculation that encodes an ATO rule should name the rule.
