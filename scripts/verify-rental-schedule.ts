/**
 * Computes the rental schedule for a real property and financial year from the
 * live database, using the same resolvers the tax pack does, and prints it.
 *
 * Exists so the track's acceptance criteria can be checked against actual data
 * rather than fixtures — the fixtures were written by the same person who wrote
 * the code, and agree with it by construction.
 *
 * Run with: npm run verify:rent-schedule [propertyAddress] [fyEndYear]
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { Database } from "../lib/supabase/database.types";
import { resolveAgentFees } from "../lib/tax/agent-fees";
import { resolveRentalIncome } from "../lib/tax/rental-income";
import { reconcileStatement } from "../lib/tax/statement-reconciliation";
import { buildRentalSchedule } from "../lib/tax/rental-schedule";
import { computeApportionment } from "../lib/tax/apportionment";
import { resolveTaxClassification } from "../lib/tax/classification";
import { daysInFy, daysAvailableInFy, fyBounds } from "../lib/tax/fy";

config({ path: ".env.local" });

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADDRESS = process.argv[2] ?? "56 Forbes St";
const FY = Number(process.argv[3] ?? 2026);

const money = (n: number) => `$${n.toFixed(2)}`;
const pad = (s: string, n: number) => s.padEnd(n);

async function main() {
  const { startDate, endDate, label } = fyBounds(FY, 7, 1);
  console.log(`Rental schedule — ${ADDRESS}, ${label} (${startDate} → ${endDate})\n`);

  const { data: property } = await admin
    .from("properties")
    .select("id, address, property_type, purchase_date")
    .eq("address", ADDRESS)
    .maybeSingle();
  if (!property) {
    console.error(`No property '${ADDRESS}' found — run npm run db:sync`);
    process.exit(1);
  }

  const [
    { data: payments },
    { data: periods },
    { data: opex },
    { data: fyFacts },
    { data: depreciation },
    { data: renovations },
  ] = await Promise.all([
    admin.from("rental_payments").select("*").eq("property_id", property.id),
    admin
      .from("rental_periods")
      .select("start_date, end_date, weekly_rent, management_fee_pct")
      .eq("property_id", property.id),
    admin
      .from("rental_operating_expenses")
      .select("category, amount, expense_date")
      .eq("property_id", property.id)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate),
    admin
      .from("property_fy_facts")
      .select("*")
      .eq("property_id", property.id)
      .eq("financial_year_end", FY)
      .maybeSingle(),
    admin
      .from("depreciation_reports")
      .select("div40_annual, div43_annual, qs_firm")
      .eq("property_id", property.id)
      .eq("financial_year_end", FY)
      .maybeSingle(),
    admin
      .from("renovations")
      .select(
        "classification, claimable, status, expenses(amount, expense_date, manual_classification, description)",
      )
      .eq("property_id", property.id)
      .eq("claimable", true)
      .neq("status", "planned"),
  ]);

  // ── Payments and reconciliation ─────────────────────────────────────────
  console.log("── Rent payments ────────────────────────────────────────────");
  const inYear = (payments ?? [])
    .filter((p) => p.payment_date >= startDate && p.payment_date <= endDate)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date));
  for (const p of inYear) {
    const rec = reconcileStatement(p);
    const state = p.fees_confirmed_at ? "confirmed" : "unconfirmed";
    const recTxt = !rec.applicable
      ? "no statement detail"
      : rec.ties
        ? "reconciles"
        : `OUT BY ${money(Math.abs(rec.difference))}`;
    console.log(
      `  ${p.payment_date}  gross ${pad(money(Number(p.amount)), 10)} ` +
        `${pad(state, 12)} ${recTxt}` +
        (p.notes?.includes("NEEDS VERIFICATION") ? "  [UNVERIFIED]" : ""),
    );
  }
  const grossSum = inYear.reduce((s, p) => s + Number(p.amount), 0);
  console.log(`  ${inYear.length} payments, gross rent recorded ${money(grossSum)}`);

  // ── Agent fees ──────────────────────────────────────────────────────────
  const fees = resolveAgentFees(payments ?? [], periods ?? [], FY, 7, 1);
  console.log("\n── Agent fees ───────────────────────────────────────────────");
  console.log(`  source                   ${fees.source}`);
  console.log(`  commission               ${money(fees.commission)}`);
  console.log(`  sundries                 ${money(fees.sundries)}`);
  console.log(
    `  actual                   ${fees.actual ? `${money(fees.actual.commission)} + ${money(fees.actual.sundries)} sundry` : "none"}`,
  );
  console.log(
    `  percentage estimate      ${fees.estimated != null ? money(fees.estimated) : "none"}`,
  );
  console.log(
    `  partial                  ${fees.partial} (${fees.paymentsWithConfirmedFees} of ${fees.paymentsInYear} payments confirmed)`,
  );
  console.log(`  unconfirmed              ${fees.unconfirmedCount}`);
  if (fees.actual && fees.estimated != null) {
    const actualTotal = fees.actual.commission + fees.actual.sundries;
    console.log(
      `  actual vs estimate       ${money(actualTotal)} vs ${money(fees.estimated)} ` +
        `(${actualTotal > fees.estimated ? "actual higher" : "ACTUAL LOWER — partial statements"})`,
    );
  }

  // ── Schedule ────────────────────────────────────────────────────────────
  const income = resolveRentalIncome(payments ?? [], periods ?? [], FY, 7, 1);
  const otherIncome = inYear.reduce((s, p) => s + Number(p.other_income ?? 0), 0);
  const apportionment = computeApportionment(
    fyFacts,
    daysInFy(FY, 7, 1),
    daysAvailableInFy(FY, property.purchase_date, null, 7, 1),
  );

  const schedule = buildRentalSchedule({
    propertyType: property.property_type,
    grossRent: income.amount,
    otherIncome,
    agentFees: fees.commission,
    agentSundries: fees.sundries,
    operatingExpenses: (opex ?? []).map((e) => ({
      category: e.category,
      amount: Number(e.amount),
    })),
    renovationExpenses: (renovations ?? []).flatMap((r) =>
      (r.expenses ?? [])
        .filter((e) => e.expense_date >= startDate && e.expense_date <= endDate)
        .map((e) => ({
          amount: Number(e.amount),
          manual_classification: e.manual_classification,
          renovation_classification: r.classification,
          claimable: r.claimable ?? true,
        })),
    ),
    interest: 0,
    capitalWorks: Number(depreciation?.div43_annual ?? 0),
    declineInValue:
      depreciation?.div40_annual != null ? Number(depreciation.div40_annual) : null,
    apportionment,
  });

  console.log("\n── Schedule ─────────────────────────────────────────────────");
  console.log(
    `  Gross rent (${income.source})           ${money(schedule.grossRent)}`,
  );
  if (schedule.otherIncome > 0)
    console.log(`  Other rental-related income        ${money(schedule.otherIncome)}`);
  console.log(`  Total income                       ${money(schedule.totalIncome)}`);
  for (const line of schedule.deductions) {
    console.log(`  ${pad(line.label, 34)}(${money(line.amount)})`);
  }
  console.log(`  ${pad("Total deductions", 34)}(${money(schedule.totalDeductions)})`);
  console.log(
    `  Net rental ${schedule.isLoss ? "loss" : "income"}                 ${money(Math.abs(schedule.netResult))}`,
  );

  // ── The Division 40 overlap this track recorded but does not fix ─────────
  if (depreciation?.div40_annual != null) {
    const repairs = (renovations ?? []).flatMap((r) =>
      (r.expenses ?? [])
        .filter((e) => e.expense_date >= startDate && e.expense_date <= endDate)
        .filter(
          (e) =>
            resolveTaxClassification(e.manual_classification, r.classification) ===
            "Repair",
        )
        .map((e) => ({ amount: Number(e.amount), description: e.description })),
    );
    if (repairs.length > 0) {
      console.log("\n── ⚠ Division 40 overlap check (recorded, not fixed) ────────");
      console.log(
        `  A ${depreciation.qs_firm ?? "QS"} schedule claims ${money(Number(depreciation.div40_annual))} of Division 40`,
      );
      console.log(
        "  this year. These repairs are CANDIDATES for overlap — each is deducted in full",
      );
      console.log(
        "  below AND would be depreciated again if the surveyor scheduled it as plant:",
      );
      for (const r of repairs) {
        console.log(
          `    ${money(r.amount)}  ${(r.description ?? "(no description)").slice(0, 60)}`,
        );
      }
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
