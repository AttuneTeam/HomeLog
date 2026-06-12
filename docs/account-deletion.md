# Account & property deletion

This documents the **invariants and gotchas** behind account/property deletion — the things
that are *not* recoverable by reading any single file. For the actual logic, follow the
pointers to the authoritative source; do not duplicate it here.

## The core invariant: delete storage by data ownership, NOT by path prefix

Uploaded files are stored at `${uploaderId}/...` — the first path segment is whoever
*uploaded* the file (see any uploader, e.g. `components/expense-form.tsx`,
`components/property-files-section.tsx`). But a file's **owner** is the owner of the property
the file's DB row belongs to, which can be a *different* user:

- An active **co-owner guest** has write access (`has_property_write_access`,
  `supabase/migrations/030_update_rls_shared_access.sql`). When they upload an invoice into the
  owner's property, the storage object lives under **the guest's** id, but the `expenses` row
  belongs to **the owner's** property.

**Therefore deletion must never scan-and-delete by `${userId}/` prefix.** Doing so would let a
guest's account deletion wipe files that belong to the owner's surviving records (data loss), or
miss files when the owner deletes. Instead, deletion is anchored to the same ownership joins the
DB cascade uses (`properties.user_id`), via two `SECURITY DEFINER` functions:

- `user_storage_objects(user_id)` — `supabase/migrations/052_*` — every storage object owned by
  the user (across all their properties + their own staged receipts).
- `property_storage_objects(property_id)` — `supabase/migrations/053_*` — every storage object
  belonging to one property.

Both return `(bucket, path)`; callers delete those exact paths with the **admin client** (the
uploader-prefix storage RLS would otherwise block deleting another user's file).

⚠️ **If you "simplify" this back to a prefix-scan you reintroduce a cross-owner data-loss bug.**
That is the whole reason these functions exist.

## Requirements this satisfies

1. Owner deletes account → all their data + files go. (DB cascade + `user_storage_objects(owner)`)
1b. Owner deletes a property → all that property's data + files go.
   (`app/actions/properties.ts` + `property_storage_objects`)
2. Guest deletes account → only data for properties *they own* is removed; files they uploaded
   into another owner's property are preserved, and membership rows are cleaned so the owner's
   Sharing panel shows no ghost entry. (`app/api/account/delete/route.ts`)

## Gotcha: auth user deletion on local Supabase

`auth.admin.deleteUser()` (the GoTrue admin API) **fails on local Supabase** — the asymmetric
(ES256) signing build rejects the service-role key (`signing method HS256 is invalid`). Delete
the auth user via the `delete_auth_user(user_id)` `SECURITY DEFINER` RPC
(`supabase/migrations/051_*`) instead, called over PostgREST (`admin.rpc(...)`), which accepts
the key. This also cascades all `ON DELETE CASCADE` data.

## Maintenance rule: file-bearing tables

Storage has no DB cascade, so every column that holds a storage path must be enumerated in the
two functions above. Current set (bucket → table.column):

| Bucket | Table.column |
|---|---|
| `invoices` | `expenses.invoice_path`, `rental_operating_expenses.invoice_path`, `staged_receipts.storage_path` |
| `property-files` | `property_files.storage_path` |
| `renovation-quotes` | `renovation_quotes.file_path` |

**When you add a new table/column that stores a file, update both `user_storage_objects` and
`property_storage_objects`** (and this table). Forgetting leaks storage on deletion.

## Verification

`npm run verify:deletion` (`scripts/verify-account-deletion.ts`) runs an end-to-end harness
against local Supabase — owner + co-owner guest, guest uploads into the owner's property — and
asserts the storage + DB outcomes for requirements 1b and 2. Run it after changing any deletion
logic or adding a file-bearing table.

## Deploy note

Migrations `051`–`053` define the functions above; apply them to production on deploy.
