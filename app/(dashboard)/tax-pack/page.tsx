import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinancialYearSelect } from "@/components/financial-year-select";
import { TaxPackGenerator, type EvidenceItem } from "@/components/tax-pack-generator";
import type { PackData, PackProperty } from "@/components/tax-pack-document";
import {
  AU_FY_START_DAY,
  AU_FY_START_MONTH,
  daysInFy,
  formatFyLabel,
  fyBounds,
  resolveFyEndYear,
  selectableFyEndYears,
} from "@/lib/tax/fy";
import { computeApportionment } from "@/lib/tax/apportionment";
import { resolveRentalIncome } from "@/lib/tax/rental-income";
import { resolveTaxClassification } from "@/lib/tax/classification";
import { div43RegisterForFy } from "@/lib/tax/div43";
import { buildRentalSchedule } from "@/lib/tax/rental-schedule";
import { buildPortfolioSummary } from "@/lib/tax/portfolio";
import { buildQuestionnaire } from "@/lib/tax/questionnaire";
import type {
  Classification,
  ManualTaxClassification,
} from "@/lib/supabase/database.types";

const SELECTABLE_YEARS = 6;
/** Long enough to fetch every document during generation. */
const SIGNED_URL_TTL_SECONDS = 60 * 30;

interface Props {
  searchParams: Promise<{ fy?: string }>;
}

function safeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export default async function TaxPackPage({ searchParams }: Props) {
  const { fy: fyParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: properties }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, financial_year_start_month, financial_year_start_day")
      .eq("id", user.id)
      .maybeSingle(),
    // RLS returns owned properties plus anything shared with this user.
    supabase
      .from("properties")
      .select(
        "id, address, suburb, state, property_type, purchase_date, purchase_price, stamp_duty",
      )
      .order("created_at", { ascending: true }),
  ]);

  const fyStartMonth = profile?.financial_year_start_month ?? AU_FY_START_MONTH;
  const fyStartDay = profile?.financial_year_start_day ?? AU_FY_START_DAY;

  const yearOptions = selectableFyEndYears(
    new Date(),
    SELECTABLE_YEARS,
    fyStartMonth,
    fyStartDay,
  ).map((fyEndYear) => ({
    fyEndYear,
    label: formatFyLabel(fyEndYear, fyStartMonth, fyStartDay),
  }));
  const fyEndYear = resolveFyEndYear(
    fyParam,
    yearOptions.map((o) => o.fyEndYear),
  ) as number;

  const fy = fyBounds(fyEndYear, fyStartMonth, fyStartDay);
  const daysInYear = daysInFy(fyEndYear, fyStartMonth, fyStartDay);

  const packProperties: PackProperty[] = [];
  const portfolioEntries: Parameters<typeof buildPortfolioSummary>[0][number][] = [];
  const evidence: EvidenceItem[] = [];
  const omissions: string[] = [];
  const questionnaireProperties: Parameters<
    typeof buildQuestionnaire
  >[0]["properties"] = [];
  const purchasedDuringYear: string[] = [];

  for (const property of properties ?? []) {
    if (
      property.purchase_date &&
      property.purchase_date >= fy.startDate &&
      property.purchase_date <= fy.endDate
    ) {
      purchasedDuringYear.push(property.address);
    }

    const [
      { data: fyFacts },
      { data: rentalPeriods },
      { data: rentalPayments },
      { data: rentalExpenses },
      { data: loanStatements },
      { data: depreciationReport },
      { data: renovations },
      { data: roiInputs },
    ] = await Promise.all([
      supabase
        .from("property_fy_facts")
        .select("*")
        .eq("property_id", property.id)
        .eq("financial_year_end", fyEndYear)
        .maybeSingle(),
      supabase
        .from("rental_periods")
        .select("start_date, end_date, weekly_rent, management_fee_pct")
        .eq("property_id", property.id),
      supabase
        .from("rental_payments")
        .select("payment_date, amount")
        .eq("property_id", property.id),
      supabase
        .from("rental_operating_expenses")
        .select("*")
        .eq("property_id", property.id)
        .gte("expense_date", fy.startDate)
        .lte("expense_date", fy.endDate),
      supabase
        .from("loan_statements")
        .select("*")
        .eq("property_id", property.id)
        .eq("financial_year_end", fyEndYear),
      supabase
        .from("depreciation_reports")
        .select("*")
        .eq("property_id", property.id)
        .eq("financial_year_end", fyEndYear)
        .maybeSingle(),
      supabase
        .from("renovations")
        .select(
          "id, name, classification, claimable, expenses(id, amount, expense_date, description, supplier, invoice_path, manual_classification, capital_works_start_date, capital_works_rate_pct)",
        )
        .eq("property_id", property.id)
        .neq("status", "planned"),
      supabase
        .from("roi_calculator_inputs")
        .select("stamp_duty")
        .eq("property_id", property.id)
        .maybeSingle(),
    ]);

    const apportionment = computeApportionment(fyFacts, daysInYear);
    const income = resolveRentalIncome(
      rentalPayments ?? [],
      rentalPeriods ?? [],
      fyEndYear,
      fyStartMonth,
      fyStartDay,
    );

    // Agent fees accrue on the tenancy terms, not on cash received.
    const agentFees = (rentalPeriods ?? []).reduce((sum, period) => {
      if (!period.management_fee_pct) return sum;
      const start = new Date(
        Math.max(
          Date.parse(`${period.start_date}T00:00:00Z`),
          Date.parse(`${fy.startDate}T00:00:00Z`),
        ),
      );
      const end = new Date(
        Math.min(
          Date.parse(
            `${period.end_date ?? fy.endDate}T00:00:00Z`,
          ),
          Date.parse(`${fy.endDate}T00:00:00Z`),
        ),
      );
      if (end <= start) return sum;
      const weeks = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7);
      return sum + weeks * period.weekly_rent * (period.management_fee_pct / 100);
    }, 0);

    const confirmedInterest = (loanStatements ?? [])
      .filter((s) => s.confirmed_at != null && s.interest_paid != null)
      .reduce((sum, s) => sum + Number(s.interest_paid), 0);
    const unconfirmed = (loanStatements ?? []).filter(
      (s) => s.confirmed_at == null,
    ).length;
    if (unconfirmed > 0) {
      omissions.push(
        `${property.address}: ${unconfirmed} loan statement(s) awaiting confirmation are excluded from the interest claimed.`,
      );
    }

    // Expenses in this FY, with their effective classification resolved once.
    const renovationExpenses: Array<{
      amount: number;
      manual_classification: ManualTaxClassification | null;
      renovation_classification: Classification;
      claimable: boolean;
    }> = [];
    let initialRepairTotal = 0;
    let capitalImprovementTotal = 0;
    // Every capital works item, including any with no completion date — the
    // register reports those rather than them being filtered out and the
    // missing deduction going unmentioned.
    const capitalWorksItems: Array<{
      id: string;
      amount: number;
      startDate: string | null;
      ratePct: number;
      description: string | null;
    }> = [];

    for (const renovation of renovations ?? []) {
      for (const expense of renovation.expenses ?? []) {
        const resolved = resolveTaxClassification(
          expense.manual_classification,
          renovation.classification,
        );
        const inFy =
          expense.expense_date >= fy.startDate &&
          expense.expense_date <= fy.endDate;

        // Cost base accumulates across all years, not just this one.
        const claimable = renovation.claimable ?? true;
        if (claimable) {
          if (resolved === "Immediate Repair")
            initialRepairTotal += Number(expense.amount);
          if (resolved === "Capital Works") {
            capitalImprovementTotal += Number(expense.amount);
            capitalWorksItems.push({
              id: expense.id,
              amount: Number(expense.amount),
              startDate: expense.capital_works_start_date,
              ratePct: Number(expense.capital_works_rate_pct ?? 2.5),
              description: expense.description ?? renovation.name,
            });
          }
        }

        if (inFy) {
          renovationExpenses.push({
            amount: Number(expense.amount),
            manual_classification: expense.manual_classification,
            renovation_classification: renovation.classification,
            claimable,
          });
        }

        if (expense.invoice_path && inFy && claimable) {
          const { data: signed } = await supabase.storage
            .from("invoices")
            .createSignedUrl(expense.invoice_path, SIGNED_URL_TTL_SECONDS);
          evidence.push({
            fileName: `${safeFileName(property.address)}/${safeFileName(
              `${expense.expense_date}-${expense.supplier ?? "expense"}-${expense.id.slice(0, 8)}`,
            )}.${expense.invoice_path.split(".").pop() ?? "pdf"}`,
            signedUrl: signed?.signedUrl ?? null,
            propertyAddress: property.address,
            kind: "Invoice",
            description:
              expense.description ?? renovation.name ?? "Renovation expense",
            date: expense.expense_date,
            amount: Number(expense.amount),
            feedsLine:
              resolved === "Repair"
                ? "Repairs and maintenance"
                : resolved === "Capital Works"
                  ? "Capital works / cost base"
                  : "CGT cost base",
          });
        }
      }
    }

    for (const expense of rentalExpenses ?? []) {
      if (!expense.invoice_path) continue;
      const { data: signed } = await supabase.storage
        .from("invoices")
        .createSignedUrl(expense.invoice_path, SIGNED_URL_TTL_SECONDS);
      evidence.push({
        fileName: `${safeFileName(property.address)}/${safeFileName(
          `${expense.expense_date}-${expense.category}-${expense.id.slice(0, 8)}`,
        )}.${expense.invoice_path.split(".").pop() ?? "pdf"}`,
        signedUrl: signed?.signedUrl ?? null,
        propertyAddress: property.address,
        kind: "Operating expense",
        description: expense.description ?? expense.category,
        date: expense.expense_date,
        amount: Number(expense.amount),
        feedsLine: expense.category.replace(/_/g, " "),
      });
    }

    for (const statement of loanStatements ?? []) {
      if (!statement.storage_path) continue;
      const { data: signed } = await supabase.storage
        .from("property-files")
        .createSignedUrl(statement.storage_path, SIGNED_URL_TTL_SECONDS);
      evidence.push({
        fileName: `${safeFileName(property.address)}/loan-statement-${safeFileName(statement.account_ref ?? statement.id.slice(0, 8))}.pdf`,
        signedUrl: signed?.signedUrl ?? null,
        propertyAddress: property.address,
        kind: "Loan statement",
        description: `${statement.lender ?? "Lender"} annual statement`,
        date: statement.period_end,
        amount: statement.interest_paid != null ? Number(statement.interest_paid) : null,
        feedsLine: "Interest on loans",
      });
    }

    if (depreciationReport?.storage_path) {
      const { data: signed } = await supabase.storage
        .from("property-files")
        .createSignedUrl(depreciationReport.storage_path, SIGNED_URL_TTL_SECONDS);
      evidence.push({
        fileName: `${safeFileName(property.address)}/depreciation-schedule.pdf`,
        signedUrl: signed?.signedUrl ?? null,
        propertyAddress: property.address,
        kind: "Depreciation schedule",
        description: `${depreciationReport.qs_firm ?? "Quantity surveyor"} schedule`,
        date: depreciationReport.report_date,
        amount: null,
        feedsLine: "Decline in value / capital works",
      });
    }

    const div43 = div43RegisterForFy(
      capitalWorksItems,
      fyEndYear,
      fyStartMonth,
      fyStartDay,
    );
    if (div43.itemsMissingStartDate > 0) {
      omissions.push(
        `${property.address}: ${div43.itemsMissingStartDate} capital works item(s) have no completion date, so no Division 43 deduction is claimed for them.`,
      );
    }

    // A surveyor's figure supersedes the register: it covers original
    // construction the owner never paid for.
    const capitalWorksClaim =
      depreciationReport?.div43_annual != null
        ? Number(depreciationReport.div43_annual)
        : div43.totalClaim;

    const schedule = buildRentalSchedule({
      propertyType: property.property_type,
      grossRent: income.amount,
      agentFees,
      operatingExpenses: (rentalExpenses ?? []).map((e) => ({
        category: e.category,
        amount: Number(e.amount),
      })),
      renovationExpenses,
      interest: confirmedInterest,
      capitalWorks: capitalWorksClaim,
      declineInValue:
        depreciationReport?.div40_annual != null
          ? Number(depreciationReport.div40_annual)
          : null,
      apportionment,
    });

    const stampDuty =
      property.stamp_duty != null
        ? { amount: Number(property.stamp_duty), source: "property" }
        : roiInputs?.stamp_duty != null
          ? { amount: Number(roiInputs.stamp_duty), source: "roi_inputs" }
          : { amount: 0, source: null };

    const purchasePrice = Number(property.purchase_price ?? 0);
    const costBase = {
      purchasePrice,
      stampDuty: stampDuty.amount,
      stampDutySource: stampDuty.source,
      initialRepairs: initialRepairTotal,
      capitalImprovements: capitalImprovementTotal,
      total:
        purchasePrice +
        stampDuty.amount +
        initialRepairTotal +
        capitalImprovementTotal,
    };

    packProperties.push({
      id: property.id,
      address: property.address,
      excludedReason: schedule.excludedReason,
      grossRent: schedule.grossRent,
      incomeSource: income.source,
      incomeCrossCheck: { actual: income.actual, accrued: income.accrued },
      materialDivergence: income.materialDivergence,
      deductions: schedule.deductions,
      totalDeductions: schedule.totalDeductions,
      netResult: schedule.netResult,
      isLoss: schedule.isLoss,
      apportionment: {
        ownershipPct: apportionment.ownershipFraction * 100,
        deductibleDayPct: apportionment.deductibleDayFraction * 100,
        assumedSoleOwnership: apportionment.assumedSoleOwnership,
        assumedFullYear: apportionment.assumedFullYear,
      },
      div43Items: div43.items,
      div43Total: capitalWorksClaim,
      div40Annual:
        depreciationReport?.div40_annual != null
          ? Number(depreciationReport.div40_annual)
          : null,
      depreciationMethod: depreciationReport?.depreciation_method ?? null,
      qsFirm: depreciationReport?.qs_firm ?? null,
      costBase,
    });

    portfolioEntries.push({
      propertyId: property.id,
      address: property.address,
      schedule,
      costBase: costBase.total,
    });

    questionnaireProperties.push({
      address: property.address,
      grossRent: schedule.grossRent,
      netResult: schedule.netResult,
      isLoss: schedule.isLoss,
      incomeSource: income.source,
      ownershipPct: apportionment.ownershipFraction * 100,
      assumedSoleOwnership: apportionment.assumedSoleOwnership,
      hasConfirmedInterest: confirmedInterest > 0,
      hasDepreciationSchedule: depreciationReport != null,
      purchaseDate: property.purchase_date,
      excluded: schedule.excludedReason != null,
    });
  }

  const portfolio = buildPortfolioSummary(portfolioEntries);

  const data: PackData = {
    taxpayerName: profile?.display_name ?? user.email ?? "Property owner",
    financialYearLabel: fy.label,
    fyStartDate: fy.startDate,
    fyEndDate: fy.endDate,
    generatedAt: new Date().toLocaleString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    properties: packProperties,
    portfolio: {
      totalGrossRent: portfolio.totalGrossRent,
      deductionTotals: portfolio.deductionTotals,
      totalDeductions: portfolio.totalDeductions,
      netResult: portfolio.netResult,
      isLoss: portfolio.isLoss,
      propertiesAtLoss: portfolio.propertiesAtLoss,
      totalCostBase: portfolio.totalCostBase,
    },
    excluded: portfolio.excluded.map((e) => ({
      address: e.address,
      reason: e.reason,
    })),
    questionnaire: buildQuestionnaire({
      financialYearLabel: fy.label,
      properties: questionnaireProperties,
      purchasedDuringYear,
    }),
    omissions,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tax pack</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Everything your accountant needs for the rental section, in one file
          </p>
        </div>
        <FinancialYearSelect options={yearOptions} selected={fyEndYear} />
      </div>

      <TaxPackGenerator data={data} evidence={evidence} />
    </div>
  );
}
