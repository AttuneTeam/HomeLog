/**
 * Verification script for account / property deletion and the shared-account
 * (co-owner guest) storage rules. Exercises the exact RPCs the deletion paths use
 * (`user_storage_objects`, `property_storage_objects`, `delete_auth_user`) against a
 * real local Supabase instance, and asserts the storage + DB outcomes.
 *
 * It sets up an OWNER and a co-owner GUEST, has the guest upload a file into the
 * owner's property, then checks the three requirements:
 *   1b. Owner deletes a property  → ALL of that property's files go (incl. guest uploads)
 *   2.  Guest deletes their account → only the guest's OWN property data goes; their
 *       uploads into the owner's property are PRESERVED
 *
 * Run with: npm run verify:deletion   (local Supabase must be running)
 * Requires: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/database.types";
import { config } from "dotenv";
config({ path: ".env.local" });

const OWNER_EMAIL = "verify-owner@homebase.test";
const GUEST_EMAIL = "verify-guest@homebase.test";
const PASSWORD = "VerifyDeletion2026!";

// Service-role client (bypasses RLS) for setup, RPCs, and storage admin ops.
const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
// Anon client for public auth (the auth-admin API is rejected on local Supabase).
const authClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? "✓" : "✗ FAIL"}  ${label}`);
  if (!ok) failures++;
}
function die(label: string, error: { message: string } | null): void {
  if (error) {
    console.error(`\nSetup failed — ${label}: ${error.message}`);
    process.exit(1);
  }
}

/** Create or sign in a user via public auth, returning their id. */
async function resolveUser(email: string): Promise<string> {
  const { data: signUp } = await authClient.auth.signUp({ email, password: PASSWORD });
  if (signUp?.user) return signUp.user.id;
  const { data: signIn, error } = await authClient.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (!signIn?.user) die(`sign in ${email}`, error);
  return signIn!.user!.id;
}

/** True if a storage object exists at bucket/path. */
async function objectExists(bucket: string, path: string): Promise<boolean> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  return !error && !!data;
}

/** Upload a tiny dummy file to bucket/path. */
async function putFile(bucket: string, path: string) {
  const body = new Blob([`dummy ${path}`], { type: "application/pdf" });
  const { error } = await admin.storage.from(bucket).upload(path, body, {
    contentType: "application/pdf",
    upsert: true,
  });
  die(`upload ${bucket}/${path}`, error);
}

/** Replicates the storage-removal loop used by both deletion paths. */
async function removeObjects(objects: { bucket: string; path: string }[]) {
  const byBucket = new Map<string, string[]>();
  for (const { bucket, path } of objects) {
    if (!path) continue;
    const list = byBucket.get(bucket) ?? [];
    list.push(path);
    byBucket.set(bucket, list);
  }
  for (const [bucket, paths] of byBucket) {
    if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
  }
}

async function main() {
  console.log("Verifying account/property deletion + shared-account storage rules\n");

  // ----------------------------------------------------------------
  // Setup
  // ----------------------------------------------------------------
  const ownerId = await resolveUser(OWNER_EMAIL);
  const guestId = await resolveUser(GUEST_EMAIL);

  await admin.from("profiles").upsert([
    { id: ownerId, display_name: "Verify Owner" },
    { id: guestId, display_name: "Verify Guest" },
  ]);

  // Clean any leftovers from a previous run.
  await admin.from("properties").delete().eq("user_id", ownerId);
  await admin.from("properties").delete().eq("user_id", guestId);
  await admin.from("account_members").delete().eq("owner_id", ownerId);

  // Owner's property + renovation
  const { data: ownerProp, error: opErr } = await admin
    .from("properties")
    .insert({ user_id: ownerId, address: "1 Owner St" })
    .select()
    .single();
  die("insert owner property", opErr);
  const ownerPropertyId = ownerProp!.id;

  const { data: ownerReno, error: orErr } = await admin
    .from("renovations")
    .insert({ property_id: ownerPropertyId, name: "Reno", classification: "repair" })
    .select()
    .single();
  die("insert owner renovation", orErr);
  const ownerRenoId = ownerReno!.id;

  // Guest's OWN property + renovation
  const { data: guestProp, error: gpErr } = await admin
    .from("properties")
    .insert({ user_id: guestId, address: "9 Guest Ave" })
    .select()
    .single();
  die("insert guest property", gpErr);
  const guestPropertyId = guestProp!.id;

  const { data: guestReno, error: grErr } = await admin
    .from("renovations")
    .insert({ property_id: guestPropertyId, name: "Guest Reno", classification: "repair" })
    .select()
    .single();
  die("insert guest renovation", grErr);
  const guestRenoId = guestReno!.id;

  // Active co-owner membership: guest can write into the owner's property.
  die(
    "insert membership",
    (
      await admin.from("account_members").insert({
        owner_id: ownerId,
        grantee_email: GUEST_EMAIL,
        grantee_user_id: guestId,
        role: "co_owner",
        status: "active",
      })
    ).error,
  );

  // Files (paths prefixed with the *uploader's* id, mirroring the real app):
  //  A — guest uploads INTO the owner's property  → stored under guestId, row belongs to owner
  //  B — owner's own file in the owner's property  → stored under ownerId
  //  C — guest's file in the guest's OWN property  → stored under guestId
  const fileA = `${guestId}/${ownerRenoId}/guest-into-owner.pdf`;
  const fileB = `${ownerId}/${ownerRenoId}/owner-own.pdf`;
  const fileC = `${guestId}/${guestRenoId}/guest-own.pdf`;
  await putFile("invoices", fileA);
  await putFile("invoices", fileB);
  await putFile("invoices", fileC);

  const expenseRows: Database["public"]["Tables"]["expenses"]["Insert"][] = [
    { renovation_id: ownerRenoId, amount: 100, category: "materials", expense_date: "2026-01-01", invoice_path: fileA, context_notes: null },
    { renovation_id: ownerRenoId, amount: 200, category: "materials", expense_date: "2026-01-02", invoice_path: fileB, context_notes: null },
    { renovation_id: guestRenoId, amount: 300, category: "materials", expense_date: "2026-01-03", invoice_path: fileC, context_notes: null },
  ];
  die("insert expenses", (await admin.from("expenses").insert(expenseRows)).error);

  console.log("Setup complete: owner + co-owner guest, 3 files staged.\n");

  // ----------------------------------------------------------------
  // Requirement 2 — guest deletes their account
  // ----------------------------------------------------------------
  console.log("Requirement 2: guest deletes account (own data only)");

  const { data: guestObjects } = await admin.rpc("user_storage_objects", {
    p_user_id: guestId,
  });
  const guestPaths = (guestObjects ?? []).map((o) => o.path);
  check("user_storage_objects(guest) includes guest's own file (C)", guestPaths.includes(fileC));
  check("user_storage_objects(guest) EXCLUDES upload into owner's property (A)", !guestPaths.includes(fileA));

  // Replicate the account-delete route:
  await removeObjects(guestObjects ?? []);
  await Promise.all([
    admin.from("user_contractors").delete().eq("user_id", guestId),
    admin.from("account_members").delete().eq("grantee_user_id", guestId),
    admin.from("property_shares").delete().eq("grantee_user_id", guestId),
  ]);
  die("delete_auth_user(guest)", (await admin.rpc("delete_auth_user", { user_id: guestId })).error);

  check("guest's own file (C) removed from storage", !(await objectExists("invoices", fileC)));
  check("guest's upload into owner property (A) PRESERVED", await objectExists("invoices", fileA));
  check("owner's own file (B) untouched", await objectExists("invoices", fileB));

  const { data: ownerStillThere } = await admin
    .from("properties")
    .select("id")
    .eq("id", ownerPropertyId)
    .maybeSingle();
  check("owner's property still exists", !!ownerStillThere);

  const { data: expenseA } = await admin
    .from("expenses")
    .select("invoice_path")
    .eq("invoice_path", fileA)
    .maybeSingle();
  check("owner's expense row still references file A", !!expenseA);

  const { data: ghost } = await admin
    .from("account_members")
    .select("id")
    .eq("owner_id", ownerId)
    .maybeSingle();
  check("no ghost membership row left in owner's Sharing panel", !ghost);

  const { data: guestPropGone } = await admin
    .from("properties")
    .select("id")
    .eq("id", guestPropertyId)
    .maybeSingle();
  check("guest's own property cascade-deleted", !guestPropGone);

  // ----------------------------------------------------------------
  // Requirement 1b — owner deletes a property
  // ----------------------------------------------------------------
  console.log("\nRequirement 1b: owner deletes property (all its files go)");

  const { data: propObjects } = await admin.rpc("property_storage_objects", {
    p_property_id: ownerPropertyId,
  });
  const propPaths = (propObjects ?? []).map((o) => o.path);
  check("property_storage_objects includes guest-uploaded file (A)", propPaths.includes(fileA));
  check("property_storage_objects includes owner's own file (B)", propPaths.includes(fileB));

  // Replicate the deleteProperty action:
  die("delete owner property", (await admin.from("properties").delete().eq("id", ownerPropertyId)).error);
  await removeObjects(propObjects ?? []);

  check("file A removed from storage", !(await objectExists("invoices", fileA)));
  check("file B removed from storage", !(await objectExists("invoices", fileB)));

  const { data: propGone } = await admin
    .from("properties")
    .select("id")
    .eq("id", ownerPropertyId)
    .maybeSingle();
  check("owner's property removed from DB", !propGone);

  // ----------------------------------------------------------------
  // Cleanup + result
  // ----------------------------------------------------------------
  await admin.from("properties").delete().eq("user_id", ownerId);
  await admin.rpc("delete_auth_user", { user_id: ownerId });

  console.log(
    failures === 0
      ? "\n✓ All checks passed.\n"
      : `\n✗ ${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
