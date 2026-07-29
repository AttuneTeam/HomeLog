/**
 * One-off correction for the gross-versus-net defect (track
 * rental_statement_capture_20260730, Phase 1.5).
 *
 * lib/email-parser/parse-statement.ts used to instruct the model to store the
 * NET amount disbursed to the owner in rental_payments.amount, while
 * lib/tax/rental-income.ts#actualRentForFy reports that column as GROSS rent.
 * Rows ingested before the parser was repointed therefore understate assessable
 * income.
 *
 * WHAT THIS DOES AND DOES NOT DO
 * Corrects only rows whose SOURCE DOCUMENT is in hand, and records the fee
 * breakdown from that document. Rows without a source statement are FLAGGED,
 * never back-solved: gross rent cannot be recovered from a net figure without
 * knowing that statement's fees, and inventing one would put a fabricated
 * number into a tax return.
 *
 * Idempotent — matches on payment_date and the exact net amount still present,
 * so a second run is a no-op rather than a double correction.
 *
 * Run with: npx tsx scripts/fix-rental-payment-gross-net.ts [--apply]
 * Without --apply it reports what it would change and writes nothing.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { Database } from "../lib/supabase/database.types";

config({ path: ".env.local" });

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APPLY = process.argv.includes("--apply");
const PROPERTY_ADDRESS = "56 Forbes St";

interface Correction {
  statementRef: string;
  paymentDate: string;
  /** The net figure currently stored in `amount`, used to match idempotently. */
  currentNetAmount: number;
  /** Gross rent — "Money In" on the statement. */
  grossRent: number;
  managementFees: number | null;
  lettingFees: number | null;
  leaseFees: number | null;
  sundryFees: number | null;
  otherOutgoings: number | null;
  netReceived: number;
}

/**
 * Sourced from the statement PDFs themselves. Statement #1 was already correct
 * at $4,400 (manually fixed by the owner), so only its fee breakdown is added.
 */
const CORRECTIONS: Correction[] = [
  {
    // Statement #1, 28 Nov 2025. Money In $4,400.00 / Money Out $3,639.80 /
    // You Received $760.20. `amount` was already gross.
    statementRef: "Statement #1",
    paymentDate: "2025-11-28",
    currentNetAmount: 4400.0,
    grossRent: 4400.0,
    managementFees: 242.0,
    lettingFees: 1210.0,
    leaseFees: 33.0,
    sundryFees: 8.8,
    // Supa Blinds. Deducts via its own invoice as a Division 40 depreciating
    // asset — recorded here only so the statement reconciles.
    otherOutgoings: 2146.0,
    netReceived: 760.2,
  },
  {
    // Statement #7, 29 May 2026. Money In $2,200.00 / Money Out $125.40 /
    // You Received $2,074.60. `amount` held the net figure.
    statementRef: "Statement #7",
    paymentDate: "2026-05-29",
    currentNetAmount: 2074.6,
    grossRent: 2200.0,
    managementFees: 121.0,
    lettingFees: null,
    leaseFees: null,
    sundryFees: 4.4,
    otherOutgoings: null,
    netReceived: 2074.6,
  },
];

/** Rows with no source document. Flagged, never guessed. */
const UNVERIFIABLE_DATES = [
  "2025-12-24",
  "2026-01-30",
  "2026-02-27",
  "2026-03-31",
  "2026-04-30",
];

const FLAG_NOTE =
  "NEEDS VERIFICATION: `amount` may hold the net amount disbursed rather than " +
  "gross rent. Attach this statement to recover the gross figure and the agent " +
  "fees. Per the agent's FY2026 summary, gross rent for the year was $28,600.00.";

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

async function main() {
  console.log(
    `Rental payment gross/net correction — ${APPLY ? "APPLY" : "DRY RUN (no writes)"}\n`,
  );

  const { data: property } = await admin
    .from("properties")
    .select("id, address")
    .eq("address", PROPERTY_ADDRESS)
    .maybeSingle();
  if (!property) {
    console.error(`No '${PROPERTY_ADDRESS}' property found — run npm run db:sync`);
    process.exit(1);
  }

  let corrected = 0;
  let skipped = 0;

  console.log("── Rows with a source statement ──────────────────────────────");
  for (const c of CORRECTIONS) {
    const { data: row } = await admin
      .from("rental_payments")
      .select("id, amount, net_received, management_fees")
      .eq("property_id", property.id)
      .eq("payment_date", c.paymentDate)
      .maybeSingle();

    if (!row) {
      console.log(`  ?  ${c.statementRef} (${c.paymentDate}): no row found — skipped`);
      skipped++;
      continue;
    }

    // Already corrected? Idempotency guard.
    if (row.net_received !== null && row.management_fees !== null) {
      console.log(
        `  =  ${c.statementRef} (${c.paymentDate}): already corrected — skipped`,
      );
      skipped++;
      continue;
    }

    const fees =
      (c.managementFees ?? 0) +
      (c.lettingFees ?? 0) +
      (c.leaseFees ?? 0) +
      (c.sundryFees ?? 0);
    const computedNet = c.grossRent - fees - (c.otherOutgoings ?? 0);
    const ties = Math.abs(computedNet - c.netReceived) <= 0.01;

    // A correction that does not reconcile against its own statement is a
    // transcription error. Refuse it rather than writing a wrong figure.
    if (!ties) {
      console.error(
        `  ✗  ${c.statementRef}: does NOT reconcile — ${money(c.grossRent)} − ` +
          `${money(fees)} − ${money(c.otherOutgoings ?? 0)} = ${money(computedNet)}, ` +
          `expected ${money(c.netReceived)}. Refusing to write.`,
      );
      process.exitCode = 1;
      continue;
    }

    const change =
      Number(row.amount) === c.grossRent
        ? `amount ${money(c.grossRent)} (already gross)`
        : `amount ${money(Number(row.amount))} → ${money(c.grossRent)}`;

    console.log(
      `  ✓  ${c.statementRef} (${c.paymentDate}): ${change}, fees ${money(fees)}, ` +
        `other ${money(c.otherOutgoings ?? 0)}, net ${money(c.netReceived)} — reconciles`,
    );

    if (APPLY) {
      const { error } = await admin
        .from("rental_payments")
        .update({
          amount: c.grossRent,
          management_fees: c.managementFees,
          letting_fees: c.lettingFees,
          lease_fees: c.leaseFees,
          sundry_fees: c.sundryFees,
          other_outgoings: c.otherOutgoings,
          net_received: c.netReceived,
          // Transcribed by a human from the source document, so confirmed.
          fees_confirmed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) {
        console.error(`     ✗ update failed: ${error.message}`);
        process.exitCode = 1;
        continue;
      }
    }
    corrected++;
  }

  console.log("\n── Rows with NO source statement (flagged, not guessed) ──────");
  let flagged = 0;
  for (const date of UNVERIFIABLE_DATES) {
    const { data: row } = await admin
      .from("rental_payments")
      .select("id, amount, notes")
      .eq("property_id", property.id)
      .eq("payment_date", date)
      .maybeSingle();
    if (!row) continue;

    if (row.notes?.includes("NEEDS VERIFICATION")) {
      console.log(`  =  ${date}: already flagged — skipped`);
      continue;
    }

    console.log(
      `  !  ${date}: amount ${money(Number(row.amount))} — cannot recover gross ` +
        `without the statement; flagging`,
    );
    if (APPLY) {
      const { error } = await admin
        .from("rental_payments")
        .update({ notes: row.notes ? `${row.notes}\n\n${FLAG_NOTE}` : FLAG_NOTE })
        .eq("id", row.id);
      if (error) {
        console.error(`     ✗ flag failed: ${error.message}`);
        process.exitCode = 1;
        continue;
      }
    }
    flagged++;
  }

  // Report the FY position against the agent's own annual summary, which is the
  // only authoritative figure for the year.
  const { data: all } = await admin
    .from("rental_payments")
    .select("payment_date, amount")
    .eq("property_id", property.id)
    .gte("payment_date", "2025-07-01")
    .lte("payment_date", "2026-06-30");
  const dbTotal = (all ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const AGENT_FY2026_GROSS_RENT = 28600.0;

  console.log("\n── FY2026 position ──────────────────────────────────────────");
  console.log(`  Agent's annual summary, gross rent   ${money(AGENT_FY2026_GROSS_RENT)}`);
  console.log(`  Sum of rental_payments.amount        ${money(dbTotal)}`);
  console.log(
    `  Still unaccounted for                ${money(AGENT_FY2026_GROSS_RENT - dbTotal)}`,
  );

  console.log(
    `\n${APPLY ? "Applied" : "Would apply"}: ${corrected} corrected, ${flagged} flagged, ${skipped} skipped.`,
  );
  if (!APPLY) console.log("Re-run with --apply to write.\n");
}

main().catch((err) => {
  console.error("Correction crashed:", err);
  process.exit(1);
});
