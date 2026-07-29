/**
 * End-to-end verification of POST /api/rental-statements/extract over real HTTP.
 *
 * Creates its own owner and a second unrelated user, drives the route with a
 * genuine session cookie, and asserts both the happy path and the failure paths
 * — including that a caller cannot attach a statement to someone else's payment.
 *
 * Makes a LIVE model call, so it is a script rather than a test.
 *
 * Requires a dev server on http://localhost:3000 and local Supabase running.
 * Run with: npm run verify:rent-route
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "dotenv";
import { Database } from "../lib/supabase/database.types";

config({ path: ".env.local" });

const BASE_URL = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const STATEMENT_PDF = "/Users/raulfelixcarrizo/Downloads/Statement #1 - OWN10905 .pdf";
const PASSWORD = "VerifyRentalStatement2026!";
const OWNER_EMAIL = "verify-rs-owner@homebase.test";
const STRANGER_EMAIL = "verify-rs-stranger@homebase.test";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗ FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
function die(label: string, error: { message: string } | null): void {
  if (error) {
    console.error(`\nSetup failed — ${label}: ${error.message}`);
    process.exit(1);
  }
}

/** Sign in and return the session cookies the SSR client would set. */
async function sessionCookieHeader(email: string): Promise<string> {
  const jar: Record<string, string> = {};
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
        setAll: (list) => {
          for (const { name, value } of list) jar[name] = value;
        },
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  die(`sign in ${email}`, error);
  const header = Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (!header) {
    console.error("No auth cookies captured — cannot drive the route.");
    process.exit(1);
  }
  return header;
}

async function resolveUser(email: string): Promise<string> {
  const anon = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: signUp } = await anon.auth.signUp({ email, password: PASSWORD });
  if (signUp?.user) return signUp.user.id;
  const { data: signIn, error } = await anon.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (!signIn?.user) die(`sign in ${email}`, error);
  return signIn!.user!.id;
}

async function post(
  cookie: string,
  body: FormData,
): Promise<{ status: number; json: Record<string, unknown>; location: string | null }> {
  const res = await fetch(`${BASE_URL}/api/rental-statements/extract`, {
    method: "POST",
    headers: { cookie },
    body,
    // Manual, so a proxy redirect is observed rather than followed. Following a
    // 307 re-POSTs the body to /login and reports that page's status, which
    // hides what actually happened.
    redirect: "manual",
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, json, location: res.headers.get("location") };
}

function statementForm(paymentId: string): FormData {
  const buffer = readFileSync(STATEMENT_PDF);
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array(buffer)], "Statement #1 - OWN10905.pdf", {
      type: "application/pdf",
    }),
  );
  form.set("paymentId", paymentId);
  return form;
}

async function main() {
  console.log("Verifying POST /api/rental-statements/extract\n");

  if (!existsSync(STATEMENT_PDF)) {
    console.error(`Statement PDF not found at ${STATEMENT_PDF}`);
    process.exit(1);
  }
  const health = await fetch(`${BASE_URL}/login`).catch(() => null);
  if (!health?.ok) {
    console.error(`No dev server at ${BASE_URL} — run npm run dev`);
    process.exit(1);
  }

  // ── Setup ───────────────────────────────────────────────────────────────
  const ownerId = await resolveUser(OWNER_EMAIL);
  const strangerId = await resolveUser(STRANGER_EMAIL);
  await admin
    .from("profiles")
    .upsert([
      { id: ownerId, display_name: "RS Owner" },
      { id: strangerId, display_name: "RS Stranger" },
    ]);
  await admin.from("properties").delete().eq("user_id", ownerId);
  await admin.from("properties").delete().eq("user_id", strangerId);

  const { data: ownerProp, error: opErr } = await admin
    .from("properties")
    .insert({ user_id: ownerId, address: "1 Statement St" })
    .select()
    .single();
  die("insert owner property", opErr);

  const { data: strangerProp, error: spErr } = await admin
    .from("properties")
    .insert({ user_id: strangerId, address: "9 Stranger Ave" })
    .select()
    .single();
  die("insert stranger property", spErr);

  // The owner's payment starts with gross rent already recorded, as an
  // email-ingested row would.
  const { data: payment, error: payErr } = await admin
    .from("rental_payments")
    .insert({
      property_id: ownerProp!.id,
      payment_date: "2025-11-28",
      amount: 4400,
    })
    .select()
    .single();
  die("insert rental payment", payErr);

  const { data: strangerPayment, error: spayErr } = await admin
    .from("rental_payments")
    .insert({
      property_id: strangerProp!.id,
      payment_date: "2025-11-28",
      amount: 1234,
    })
    .select()
    .single();
  die("insert stranger payment", spayErr);

  const ownerCookie = await sessionCookieHeader(OWNER_EMAIL);
  console.log("Setup complete: owner + stranger, one payment each.\n");

  // ── Failure path: unauthenticated ───────────────────────────────────────
  console.log("Failure paths:");
  // The route is NOT in the proxy.ts allowlist, so an unauthenticated request is
  // redirected to /login before the handler runs. The route's own getUser()
  // check is defence in depth for if that allowlist ever changes; RLS remains
  // the actual boundary.
  const noAuth = await post("", statementForm(payment!.id));
  check(
    "unauthenticated → 307 to /login, blocked by proxy before the handler",
    noAuth.status === 307 && (noAuth.location ?? "").endsWith("/login"),
    `got ${noAuth.status} ${noAuth.location ?? ""}`,
  );

  // ── Failure path: no file ───────────────────────────────────────────────
  const noFile = new FormData();
  noFile.set("paymentId", payment!.id);
  const missingFile = await post(ownerCookie, noFile);
  check("missing file → 400", missingFile.status === 400, `got ${missingFile.status}`);

  // ── Failure path: no paymentId ──────────────────────────────────────────
  const noId = new FormData();
  noId.set("file", new File([new Uint8Array([1, 2, 3])], "x.pdf", { type: "application/pdf" }));
  const missingId = await post(ownerCookie, noId);
  check("missing paymentId → 400", missingId.status === 400, `got ${missingId.status}`);

  // ── Failure path: another user's payment ────────────────────────────────
  // The select is RLS-filtered, so a payment the caller cannot read is simply
  // not found. This is the check that matters: it must not be attachable.
  const foreign = await post(ownerCookie, statementForm(strangerPayment!.id));
  check(
    "another user's payment → 404, not attached",
    foreign.status === 404,
    `got ${foreign.status}`,
  );
  const { data: strangerAfter } = await admin
    .from("rental_payments")
    .select("statement_path, amount")
    .eq("id", strangerPayment!.id)
    .single();
  check(
    "stranger's payment untouched — no statement, amount unchanged",
    strangerAfter!.statement_path === null && Number(strangerAfter!.amount) === 1234,
  );

  // ── Happy path ──────────────────────────────────────────────────────────
  console.log("\nHappy path (live extraction of the real statement):");
  const ok = await post(ownerCookie, statementForm(payment!.id));
  check("upload + extract → 200", ok.status === 200, `got ${ok.status}`);
  if (ok.status !== 200) {
    console.error(JSON.stringify(ok.json, null, 2));
    process.exit(1);
  }
  check("no extraction error reported", ok.json.extractionError == null);

  const { data: after } = await admin
    .from("rental_payments")
    .select("*")
    .eq("id", payment!.id)
    .single();

  check("statement_path set", !!after!.statement_path);
  check(
    "stored in the property-files path for this owner and property",
    (after!.statement_path ?? "").startsWith(`${ownerId}/${ownerProp!.id}/rental-statements/`),
  );
  check("management_fees = 242.00", Number(after!.management_fees) === 242);
  check("letting_fees = 1210.00", Number(after!.letting_fees) === 1210);
  check("lease_fees = 33.00", Number(after!.lease_fees) === 33);
  check("sundry_fees = 8.80", Number(after!.sundry_fees) === 8.8);
  check("other_outgoings = 2146.00 (blinds, not a fee)", Number(after!.other_outgoings) === 2146);
  check("net_received = 760.20", Number(after!.net_received) === 760.2);
  check("confidence recorded", after!.confidence != null);
  check("extracted jsonb recorded", after!.extracted != null);
  check(
    "fees_confirmed_at is NULL — extraction is a proposal, not claimable",
    after!.fees_confirmed_at === null,
  );
  check(
    "amount NOT overwritten by the upload (still 4400.00 gross)",
    Number(after!.amount) === 4400,
  );

  // The stored object must actually exist in the bucket.
  const { data: dl } = await admin.storage
    .from("property-files")
    .download(after!.statement_path!);
  check("uploaded object is retrievable from storage", !!dl);

  // ── Replacing a statement removes the previous object ───────────────────
  console.log("\nReplacing an existing statement:");
  const firstPath = after!.statement_path!;
  const replaced = await post(ownerCookie, statementForm(payment!.id));
  check("second upload → 200", replaced.status === 200, `got ${replaced.status}`);
  const { data: after2 } = await admin
    .from("rental_payments")
    .select("statement_path")
    .eq("id", payment!.id)
    .single();
  check("statement_path points at the new object", after2!.statement_path !== firstPath);
  const { data: oldObj } = await admin.storage.from("property-files").download(firstPath);
  check("previous object removed — no orphan left in storage", !oldObj);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  const { data: leftover } = await admin.rpc("property_storage_objects", {
    p_property_id: ownerProp!.id,
  });
  for (const o of leftover ?? []) {
    if (o.path) await admin.storage.from(o.bucket).remove([o.path]);
  }
  await admin.from("properties").delete().eq("user_id", ownerId);
  await admin.from("properties").delete().eq("user_id", strangerId);
  await admin.rpc("delete_auth_user", { user_id: ownerId });
  await admin.rpc("delete_auth_user", { user_id: strangerId });
  console.log("\nCleaned up test users, properties and storage.");

  console.log(
    failures === 0 ? "\n✓ All checks passed.\n" : `\n✗ ${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
