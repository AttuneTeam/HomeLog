/**
 * Manual verification: run the extractor against the real statement PDFs and
 * check the result against figures transcribed by hand.
 *
 * This makes a LIVE model call, so it is a script and not a test — workflow.md
 * forbids calling a provider from the test suite.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { extractRentalStatementFields } from "../lib/ai/extract-rental-statement";
import { reconcileStatement } from "../lib/tax/statement-reconciliation";

config({ path: ".env.local" });

interface Expected {
  label: string;
  path: string;
  gross_rent: number;
  management_fees: number | null;
  letting_fees: number | null;
  lease_fees: number | null;
  sundry_fees: number | null;
  other_outgoings: number | null;
  net_received: number;
}

const CASES: Expected[] = [
  {
    label: "Statement #1 — 28 Nov 2025",
    path: "/Users/raulfelixcarrizo/Downloads/Statement #1 - OWN10905 .pdf",
    gross_rent: 4400,
    management_fees: 242,
    letting_fees: 1210,
    lease_fees: 33,
    sundry_fees: 8.8,
    other_outgoings: 2146,
    net_received: 760.2,
  },
  {
    label: "Statement #7 — 29 May 2026",
    path: "/Users/raulfelixcarrizo/Desktop/Statement #7 - OWN10905 .pdf",
    gross_rent: 2200,
    management_fees: 121,
    letting_fees: null,
    lease_fees: null,
    sundry_fees: 4.4,
    other_outgoings: null,
    net_received: 2074.6,
  },
];

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗ FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
/** Null and 0 are both acceptable where the statement shows no such charge. */
function eqOrAbsent(actual: number | null, expected: number | null): boolean {
  if (expected === null) return actual === null || actual === 0;
  return actual !== null && Math.abs(actual - expected) < 0.01;
}

async function main() {
  for (const c of CASES) {
    console.log(`\n══ ${c.label} ══`);
    const buffer = readFileSync(c.path);
    const fields = await extractRentalStatementFields(buffer, "application/pdf");
    console.log(JSON.stringify(fields, null, 2));

    console.log("\n  Against hand-transcribed figures:");
    check(
      `gross_rent = ${c.gross_rent} (NOT the disbursed ${c.net_received})`,
      eqOrAbsent(fields.gross_rent, c.gross_rent),
      `got ${fields.gross_rent}`,
    );
    check(
      `net_received = ${c.net_received}`,
      eqOrAbsent(fields.net_received, c.net_received),
      `got ${fields.net_received}`,
    );
    check(
      "gross_rent and net_received are different values",
      fields.gross_rent !== fields.net_received,
    );
    check(
      `management_fees = ${c.management_fees}`,
      eqOrAbsent(fields.management_fees, c.management_fees),
      `got ${fields.management_fees}`,
    );
    check(
      `letting_fees = ${c.letting_fees}`,
      eqOrAbsent(fields.letting_fees, c.letting_fees),
      `got ${fields.letting_fees}`,
    );
    check(
      `lease_fees = ${c.lease_fees}`,
      eqOrAbsent(fields.lease_fees, c.lease_fees),
      `got ${fields.lease_fees}`,
    );
    check(
      `sundry_fees = ${c.sundry_fees}`,
      eqOrAbsent(fields.sundry_fees, c.sundry_fees),
      `got ${fields.sundry_fees}`,
    );
    check(
      `other_outgoings = ${c.other_outgoings} (third party, NOT a fee)`,
      eqOrAbsent(fields.other_outgoings, c.other_outgoings),
      `got ${fields.other_outgoings}`,
    );

    const r = reconcileStatement({
      amount: fields.gross_rent ?? 0,
      management_fees: fields.management_fees,
      letting_fees: fields.letting_fees,
      lease_fees: fields.lease_fees,
      sundry_fees: fields.sundry_fees,
      other_outgoings: fields.other_outgoings,
      other_income: fields.other_income,
      net_received: fields.net_received,
    });
    check(
      `reconciles from the EXTRACTED figures (computed ${r.computedNet.toFixed(2)} vs stated ${(fields.net_received ?? 0).toFixed(2)})`,
      r.applicable && r.ties,
    );
    console.log(`  confidence: ${fields.confidence}`);
    if (fields.notes) console.log(`  notes: ${fields.notes}`);
  }

  console.log(
    failures === 0 ? "\n✓ All checks passed.\n" : `\n✗ ${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Extraction crashed:", err);
  process.exit(1);
});
