/**
 * Proves the inbound-email column mapping end to end for a rental statement:
 *   model response text → parseStatementResponse → rental_payments insert →
 *   read back → reconcile.
 *
 * The webhook's Svix verification and attachment handling are untouched by the
 * change under test, so they are deliberately not re-exercised here. What is
 * being proven is that each parsed field lands in the right column and that
 * gross rent, not the disbursed amount, ends up in `amount`.
 *
 * Inserts against a real local property and deletes the row afterwards.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { Database } from "../lib/supabase/database.types";
import { parseStatementResponse } from "../lib/email-parser/parse-statement";

config({ path: ".env.local" });

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗ FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// Exactly what the model should return for statement OWN10905.
const MODEL_RESPONSE = `Here is the extracted data:
{
  "type": "rental_payment",
  "amount": 4400,
  "gstAmount": null,
  "paymentDate": "2025-11-28",
  "periodStart": "2025-11-22",
  "periodEnd": "2025-12-19",
  "supplier": "Rich & Oliva Pty Ltd",
  "abn": "52003845047",
  "category": null,
  "propertyAddress": "56 Forbes St, Croydon Park NSW 2133",
  "confidence": 0.95,
  "managementFees": 242,
  "lettingFees": 1210,
  "leaseFees": 33,
  "sundryFees": 8.80,
  "otherOutgoings": 2146,
  "netReceived": 760.20
}`;

async function main() {
  console.log("Verifying inbound-email rental statement column mapping\n");

  const parsed = parseStatementResponse(MODEL_RESPONSE);
  console.log("Parsed from model response:");
  check("amount is GROSS rent (4400)", parsed.amount === 4400, String(parsed.amount));
  check("netReceived is the disbursed figure (760.20)", parsed.netReceived === 760.2);
  check("amount is NOT the disbursed figure", parsed.amount !== parsed.netReceived);

  const { data: property } = await admin
    .from("properties")
    .select("id, address")
    .eq("address", "56 Forbes St")
    .maybeSingle();
  if (!property) {
    console.error("\nNo '56 Forbes St' property found locally — run npm run db:sync");
    process.exit(1);
  }

  // The exact insert app/api/inbound-email/handler.ts now builds.
  console.log("\nInserting via the typed client (handler's payload shape):");
  const { data: row, error } = await admin
    .from("rental_payments")
    .insert({
      property_id: property.id,
      rental_period_id: null,
      payment_date: parsed.paymentDate!,
      amount: parsed.amount!,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
      source_email_id: "verify-mapping-test",
      raw_subject: "Statement #1 - OWN10905 (verification)",
      management_fees: parsed.managementFees,
      letting_fees: parsed.lettingFees,
      lease_fees: parsed.leaseFees,
      sundry_fees: parsed.sundryFees,
      other_outgoings: parsed.otherOutgoings,
      net_received: parsed.netReceived,
      extracted: { ...parsed, source: "inbound_email" },
      confidence: parsed.confidence,
      fees_confirmed_at: null,
    })
    .select("*")
    .single();

  if (error || !row) {
    console.error(`  ✗ insert failed: ${error?.message}`);
    process.exit(1);
  }
  check("insert succeeded", true);

  console.log("\nRead back from the database:");
  check("amount = 4400.00 (gross)", Number(row.amount) === 4400, String(row.amount));
  check("management_fees = 242.00", Number(row.management_fees) === 242);
  check("letting_fees = 1210.00", Number(row.letting_fees) === 1210);
  check("lease_fees = 33.00", Number(row.lease_fees) === 33);
  check("sundry_fees = 8.80", Number(row.sundry_fees) === 8.8);
  check("other_outgoings = 2146.00", Number(row.other_outgoings) === 2146);
  check("net_received = 760.20", Number(row.net_received) === 760.2);
  check("confidence persisted", Number(row.confidence) === 0.95);
  check("extracted jsonb persisted", row.extracted !== null);
  check(
    "fees_confirmed_at is NULL — ingested fees are not claimable yet",
    row.fees_confirmed_at === null,
  );

  const fees =
    Number(row.management_fees) +
    Number(row.letting_fees) +
    Number(row.lease_fees) +
    Number(row.sundry_fees);
  const computedNet = Number(row.amount) - fees - Number(row.other_outgoings);
  check(
    `reconciles: 4400 − ${fees.toFixed(2)} − 2146 = ${computedNet.toFixed(2)}`,
    Math.abs(computedNet - Number(row.net_received)) <= 1,
  );

  // Cleanup — this row must not pollute the user's working data.
  await admin.from("rental_payments").delete().eq("id", row.id);
  const { data: gone } = await admin
    .from("rental_payments")
    .select("id")
    .eq("id", row.id)
    .maybeSingle();
  check("verification row cleaned up", !gone);

  console.log(
    failures === 0 ? "\n✓ All checks passed.\n" : `\n✗ ${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
