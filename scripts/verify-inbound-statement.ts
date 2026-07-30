/**
 * End-to-end verification that a forwarded agent email saves the statement PDF
 * against the rent payment it creates, not just the figures read off it.
 *
 * Calls handleInboundEmail directly — it takes its Supabase client as a
 * parameter and touches no request-scoped API, so the whole ingestion path is
 * reachable from a script. Makes a LIVE model call, so this is not a test.
 *
 * Run with: npm run verify:inbound-statement
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { handleInboundEmail } from "../app/api/inbound-email/handler";
import { Database } from "../lib/supabase/database.types";

config({ path: ".env.local" });

const STATEMENT_PDF =
  "/Users/raulfelixcarrizo/Downloads/Statement #1 - OWN10905 .pdf";
const OWNER_EMAIL = "verify-inbound@homebase.test";
const PASSWORD = "VerifyInbound2026!";

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

function rawEmail(body: string): string {
  return [
    "From: accounts@richandoliva.com.au",
    "Subject: Statement #1 - OWN10905",
    "Content-Type: text/plain",
    "",
    body,
  ].join("\r\n");
}

async function main() {
  console.log("Verifying inbound-email statement attachment\n");

  if (!existsSync(STATEMENT_PDF)) {
    console.error(`Statement PDF not found at ${STATEMENT_PDF}`);
    process.exit(1);
  }
  const pdf = readFileSync(STATEMENT_PDF);

  // ── Setup ───────────────────────────────────────────────────────────────
  const anon = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: signUp } = await anon.auth.signUp({
    email: OWNER_EMAIL,
    password: PASSWORD,
  });
  let userId = signUp?.user?.id;
  if (!userId) {
    const { data: signIn, error } = await anon.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: PASSWORD,
    });
    if (!signIn?.user) die("sign in", error);
    userId = signIn!.user!.id;
  }
  await admin.from("profiles").upsert({ id: userId, display_name: "Inbound Owner" });
  await admin.from("properties").delete().eq("user_id", userId);
  await admin.from("email_ingestion_log").delete().eq("user_id", userId);

  const { data: property, error: propErr } = await admin
    .from("properties")
    .insert({ user_id: userId, address: "1 Inbound St" })
    .select()
    .single();
  die("insert property", propErr);
  const propertyId = property!.id;

  die(
    "insert rental period",
    (
      await admin.from("rental_periods").insert({
        property_id: propertyId,
        start_date: "2025-11-22",
        weekly_rent: 1100,
        management_fee_pct: 5,
      })
    ).error,
  );

  console.log("Setup complete: owner, property, tenancy.\n");

  // ── Happy path: statement PDF attached ──────────────────────────────────
  console.log("Happy path — forwarded email with the statement attached:");
  const messageId = `verify-inbound-${Date.now()}`;
  const result = await handleInboundEmail(admin, {
    userId,
    propertyId,
    sender: "accounts@richandoliva.com.au",
    to: "rent@mail.homebase.app",
    subject: "Statement #1 - OWN10905",
    messageId,
    rawEmail: rawEmail("Please find your statement attached."),
    attachments: [
      // A photo alongside the statement, so attachment selection is exercised
      // rather than assumed.
      {
        filename: "maintenance-photo.jpg",
        contentType: "image/jpeg",
        buffer: Buffer.from("not-a-statement"),
      },
      {
        filename: "Statement #1 - OWN10905.pdf",
        contentType: "application/pdf",
        buffer: pdf,
      },
    ],
  });

  check("ingestion reported parsed", result.status === "parsed", result.status);
  check("a rent payment was created", !!result.recordId);
  if (!result.recordId) {
    console.error("No record created — aborting.");
    process.exit(1);
  }

  const { data: row } = await admin
    .from("rental_payments")
    .select("*")
    .eq("id", result.recordId)
    .single();

  check("statement_path was set", !!row!.statement_path);
  check(
    "stored under the same path shape as the manual upload",
    (row!.statement_path ?? "").startsWith(
      `${userId}/${propertyId}/rental-statements/`,
    ),
    row!.statement_path ?? "",
  );
  check(
    "the PDF was chosen over the image",
    (row!.statement_path ?? "").endsWith(".pdf"),
    row!.statement_path ?? "",
  );
  check(
    "extracted records which file it came from",
    (row!.extracted as { statement_filename?: string } | null)
      ?.statement_filename === "Statement #1 - OWN10905.pdf",
  );

  // The figures the pack depends on.
  check("amount is GROSS rent 4400.00", Number(row!.amount) === 4400, String(row!.amount));
  check("amount is NOT the 760.20 disbursed", Number(row!.amount) !== 760.2);
  check("net_received = 760.20", Number(row!.net_received) === 760.2, String(row!.net_received));
  check("management_fees = 242.00", Number(row!.management_fees) === 242);
  check("letting_fees = 1210.00", Number(row!.letting_fees) === 1210);
  check("lease_fees = 33.00", Number(row!.lease_fees) === 33);
  check("sundry_fees = 8.80", Number(row!.sundry_fees) === 8.8);
  check(
    "other_outgoings = 2146.00",
    Number(row!.other_outgoings) === 2146,
    `got ${row!.other_outgoings}`,
  );
  console.log(
    `     extracted: ${JSON.stringify(
      {
        amount: (row!.extracted as Record<string, unknown>)?.amount,
        otherOutgoings: (row!.extracted as Record<string, unknown>)?.otherOutgoings,
        otherIncome: (row!.extracted as Record<string, unknown>)?.otherIncome,
        netReceived: (row!.extracted as Record<string, unknown>)?.netReceived,
        confidence: (row!.extracted as Record<string, unknown>)?.confidence,
      },
    )}`,
  );
  check(
    "other_income is null — statement #1 has no non-rent income",
    row!.other_income === null || Number(row!.other_income) === 0,
    `got ${row!.other_income}`,
  );
  // The reconciliation is the safety net: if the model misreads any component
  // the identity stops closing, which is what surfaces it to a human.
  const recFees =
    Number(row!.management_fees ?? 0) +
    Number(row!.letting_fees ?? 0) +
    Number(row!.lease_fees ?? 0) +
    Number(row!.sundry_fees ?? 0);
  const recNet =
    Number(row!.amount) +
    Number(row!.other_income ?? 0) -
    recFees -
    Number(row!.other_outgoings ?? 0);
  check(
    "the extracted figures reconcile to the disbursed amount",
    Math.abs(recNet - Number(row!.net_received ?? 0)) <= 1,
    `computed ${recNet.toFixed(2)} vs stated ${Number(row!.net_received ?? 0).toFixed(2)}`,
  );
  check(
    "fees_confirmed_at is NULL — extraction is a proposal",
    row!.fees_confirmed_at === null,
  );

  // Storage and deletion coverage.
  const { data: obj } = await admin.storage
    .from("property-files")
    .download(row!.statement_path!);
  check("the object is retrievable from property-files", !!obj);
  check(
    "the object is the PDF, not the photo",
    (obj?.size ?? 0) === pdf.byteLength,
    `${obj?.size ?? 0} vs ${pdf.byteLength}`,
  );

  const { data: objects } = await admin.rpc("property_storage_objects", {
    p_property_id: propertyId,
  });
  check(
    "property_storage_objects includes it, so deletion will clean it up",
    (objects ?? []).some((o) => o.path === row!.statement_path),
  );

  // ── Failure path: the same email again ──────────────────────────────────
  console.log("\nFailure path — the same email forwarded twice:");
  const before = await admin
    .from("rental_payments")
    .select("id")
    .eq("property_id", propertyId);
  const dup = await handleInboundEmail(admin, {
    userId,
    propertyId,
    sender: "accounts@richandoliva.com.au",
    to: "rent@mail.homebase.app",
    subject: "Statement #1 - OWN10905",
    messageId,
    rawEmail: rawEmail("Please find your statement attached."),
    attachments: [
      {
        filename: "Statement #1 - OWN10905.pdf",
        contentType: "application/pdf",
        buffer: pdf,
      },
    ],
  });
  check("reported duplicate", dup.status === "duplicate", dup.status);
  const after = await admin
    .from("rental_payments")
    .select("id")
    .eq("property_id", propertyId);
  check(
    "no second payment row was created",
    (after.data ?? []).length === (before.data ?? []).length,
  );
  const { data: objectsAfter } = await admin.rpc("property_storage_objects", {
    p_property_id: propertyId,
  });
  check(
    "no orphan object — dedup returns before anything is uploaded",
    (objectsAfter ?? []).length === (objects ?? []).length,
  );

  // ── Failure path: no attachment ─────────────────────────────────────────
  console.log("\nFailure path — statement in the body, nothing attached:");
  const noAttach = await handleInboundEmail(admin, {
    userId,
    propertyId,
    sender: "accounts@richandoliva.com.au",
    to: "rent@mail.homebase.app",
    subject: "Statement #2 - OWN10905",
    messageId: `${messageId}-noattach`,
    rawEmail: rawEmail(
      "Money In $2,200.00\nManagement Fees $121.00\nYou Received $2,079.00\nRent paid to 22/05/2026",
    ),
    attachments: [],
  });
  check("still parsed", noAttach.status === "parsed", noAttach.status);
  if (noAttach.recordId) {
    const { data: bodyRow } = await admin
      .from("rental_payments")
      .select("statement_path, amount")
      .eq("id", noAttach.recordId)
      .single();
    check("statement_path is null, and the payment survives", bodyRow!.statement_path === null);
    check("figures were still extracted from the body", Number(bodyRow!.amount) > 0);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  const { data: leftover } = await admin.rpc("property_storage_objects", {
    p_property_id: propertyId,
  });
  for (const o of leftover ?? []) {
    if (o.path) await admin.storage.from(o.bucket).remove([o.path]);
  }
  await admin.from("properties").delete().eq("user_id", userId);
  await admin.from("email_ingestion_log").delete().eq("user_id", userId);
  await admin.rpc("delete_auth_user", { user_id: userId });
  console.log("\nCleaned up test user, property and storage.");

  console.log(
    failures === 0 ? "\n✓ All checks passed.\n" : `\n✗ ${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
