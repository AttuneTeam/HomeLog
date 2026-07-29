import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { FinancialYearSelect } from "@/components/financial-year-select";
import { PropertyFyFactsPanel } from "@/components/property-fy-facts-panel";
import { LoanStatementsPanel } from "@/components/loan-statements-panel";
import { DepreciationReportPanel } from "@/components/depreciation-report-panel";
import { TaxPackGenerator, type EvidenceItem } from "@/components/tax-pack-generator";
import type { PackData } from "@/components/tax-pack-document";
import { buildRentalSchedule } from "@/lib/tax/rental-schedule";
import { buildQuestionnaire } from "@/lib/tax/questionnaire";
import { capitalTotalsForCostBase } from "@/lib/tax/cost-base";
import { TaxReport } from "@/components/tax-report";
import type { TaxExpense, TaxReportData } from "@/components/tax-report";
import { resolveTaxClassification } from "@/lib/tax/classification";
import { resolveRentalIncome } from "@/lib/tax/rental-income";
import { estimateInterestForFy } from "@/lib/tax/loan-interest";
import { div43RegisterForFy } from "@/lib/tax/div43";
import {
  apportionDeduction,
  apportionIncome,
  computeApportionment,
} from "@/lib/tax/apportionment";
import {
  AU_FY_START_DAY,
  AU_FY_START_MONTH,
  daysInFy,
  formatFyLabel,
  fyBounds,
  resolveFyEndYear,
  selectableFyEndYears,
  suggestAvailabilityFromTenancies,
} from "@/lib/tax/fy";

/** How many completed financial years to offer in the selector. */
const SELECTABLE_YEARS = 6;
/** Long enough to fetch every document while the pack is being assembled. */
const SIGNED_URL_TTL_SECONDS = 60 * 30;

function safeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

interface Props {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ fy?: string }>;
}

export default async function TaxReportPage({ params, searchParams }: Props) {
  const { propertyId } = await params;
  const { fy: fyParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch property
  const { data: property } = await supabase
    .from("properties")
    .select(
      "id, address, suburb, state, postcode, property_type, purchase_date, purchase_price, stamp_duty",
    )
    .eq("id", propertyId)
    .single();

  if (!property) notFound();

  // Fetch renovations with all expense fields (exclude non-claimable)
  const { data: renovations } = await supabase
    .from("renovations")
    .select(
      "id, name, description, classification, claimable, expenses(id, expense_date, supplier, abn, category, amount, gst_amount, description, invoice_path, manual_classification)",
    )
    .eq("property_id", propertyId)
    .eq("claimable", true)
    .neq("status", "planned")
    .order("start_date", { ascending: true });

  // Fetch ROI calculator inputs, rental periods, profile, and Xero connection in parallel
  const [{ data: roiInputs }, { data: rentalPeriods }, { data: profile }, { data: xeroConnection }] =
    await Promise.all([
      // Scoped by property_id: migration 009 dropped user_id from this table.
      // Filtering on it made the query error, so stamp duty and depreciation
      // were silently absent from the CGT cost base.
      supabase
        .from("roi_calculator_inputs")
        .select(
          "stamp_duty, weekly_rent, div43_depreciation, div40_depreciation",
        )
        .eq("property_id", propertyId)
        .maybeSingle(),
      supabase
        .from("rental_periods")
        .select("start_date, end_date, weekly_rent, management_fee_pct")
        .eq("property_id", propertyId),
      supabase
        .from("profiles")
        .select("display_name, financial_year_start_month, financial_year_start_day")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("xero_connections")
        .select("tenant_id, tenant_name")
        .eq("user_id", user.id)
        .order("connected_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // Financial year is chosen explicitly, not inferred from today's date. The
  // profile carries the FY start (1-based month), defaulting to 1 July.
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

  // Defaults to the most recently completed year — the one a return covers.
  // An unparseable or out-of-range ?fy= falls back rather than 404ing, so a
  // stale link still renders something correct.
  const selectedFyEndYear = resolveFyEndYear(
    fyParam,
    yearOptions.map((o) => o.fyEndYear),
  ) as number;

  const fy = fyBounds(selectedFyEndYear, fyStartMonth, fyStartDay);
  const fyStartStr = fy.startDate;
  const fyEndStr = fy.endDate;
  const financialYear = fy.label;
  // Parsed as UTC to match the helper; a local-time parse would shift the
  // boundary by the host's offset.
  const fyStart = new Date(`${fyStartStr}T00:00:00Z`);
  const fyEnd = new Date(`${fyEndStr}T00:00:00Z`);

  // Per-year ownership and availability for the selected year.
  const { data: fyFacts } = await supabase
    .from("property_fy_facts")
    .select("*")
    .eq("property_id", propertyId)
    .eq("financial_year_end", selectedFyEndYear)
    .maybeSingle();

  // Inclusive day count for the selected year — 366 in a leap year, so the
  // "available all year" default is never quietly wrong.
  const daysInYear = daysInFy(selectedFyEndYear, fyStartMonth, fyStartDay);

  // Availability starting point derived from tenancies already recorded, so
  // the user confirms rather than retypes dates the system can infer. Tenancy
  // is a lower bound on availability, never the recorded fact itself.
  const availabilitySuggestion = suggestAvailabilityFromTenancies(
    rentalPeriods ?? [],
    selectedFyEndYear,
    fyStartMonth,
    fyStartDay,
  );

  // Loan statements for this year, plus the loan terms behind the estimate
  // shown when none has been uploaded.
  const [{ data: loanStatements }, { data: propertyLoan }, { data: interestRates }] =
    await Promise.all([
      supabase
        .from("loan_statements")
        .select("*")
        .eq("property_id", propertyId)
        .eq("financial_year_end", selectedFyEndYear)
        .order("created_at", { ascending: true }),
      supabase
        .from("property_loans")
        .select("loan_amount, start_date")
        .eq("property_id", propertyId)
        .maybeSingle(),
      supabase
        .from("loan_interest_rates")
        .select("rate, effective_date")
        .eq("property_id", propertyId)
        .order("effective_date", { ascending: true }),
    ]);

  // Offset balances reduce the interest-bearing balance directly.
  const { data: offsetAccounts } = await supabase
    .from("property_offset_accounts")
    .select("balance")
    .eq("property_id", propertyId);
  const totalOffset = (offsetAccounts ?? []).reduce(
    (sum, a) => sum + Number(a.balance),
    0,
  );

  // Prorates from the loan's drawdown date, segments by rate changes, and nets
  // off the offset. Still does not amortise, which the panel discloses.
  const interestEstimate = estimateInterestForFy(
    {
      loanAmount: propertyLoan?.loan_amount ?? null,
      offsetBalance: totalOffset,
      startDate: propertyLoan?.start_date ?? null,
      rates: interestRates ?? [],
    },
    selectedFyEndYear,
    fyStartMonth,
    fyStartDay,
  );

  // Only confirmed statements are claimable. An unconfirmed extraction is a
  // model's proposal, not evidence.
  const confirmedInterest = (loanStatements ?? [])
    .filter((s) => s.confirmed_at != null && s.interest_paid != null)
    .reduce((sum, s) => sum + Number(s.interest_paid), 0);

  // Fetch rental operating expenses and recorded payments now that FY dates
  // are known. Payments are the actuals a return is built on; the tenancy
  // accrual below is the cross-check.
  const [{ data: rentalExpenses }, { data: rentalPayments }] = await Promise.all([
    supabase
      .from("rental_operating_expenses")
      .select("*")
      .eq("property_id", propertyId)
      .gte("expense_date", fyStartStr)
      .lte("expense_date", fyEndStr)
      .order("expense_date", { ascending: true }),
    supabase
      .from("rental_payments")
      .select("payment_date, amount")
      .eq("property_id", propertyId)
      .order("payment_date", { ascending: true }),
  ]);

  function fyClampedWeeks(period: {
    start_date: string;
    end_date: string | null;
    weekly_rent: number;
  }): number {
    const start = new Date(
      Math.max(new Date(period.start_date).getTime(), fyStart.getTime()),
    );
    // An open-ended tenancy ran to the end of the year. The selector only
    // offers completed years, so clamping to fyEnd is always correct and
    // removes any dependence on today's date.
    const end = new Date(
      Math.min(
        (period.end_date ? new Date(period.end_date) : fyEnd).getTime(),
        fyEnd.getTime(),
      ),
    );
    if (end <= start) return 0;
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7);
  }

  // Prefer what was actually received; fall back to the tenancy accrual and
  // label it. Both figures are carried so the report can show the cross-check.
  const income = resolveRentalIncome(
    rentalPayments ?? [],
    rentalPeriods ?? [],
    selectedFyEndYear,
    fyStartMonth,
    fyStartDay,
  );
  const totalRentalIncome = income.amount;

  const totalAgentFees =
    rentalPeriods?.reduce((sum, period) => {
      if (!period.management_fee_pct) return sum;
      const weeks = fyClampedWeeks(period);
      return sum + weeks * period.weekly_rent * (period.management_fee_pct / 100);
    }, 0) ?? 0;

  const grossOperatingExpenses =
    rentalExpenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;

  // Apportion to the taxpayer's share. Ownership applies to both sides;
  // availability and private use reduce deductions only, never income.
  const apportionment = computeApportionment(fyFacts, daysInYear);
  const apportionedIncome =
    totalRentalIncome != null
      ? apportionIncome(totalRentalIncome, apportionment)
      : null;
  const apportionedAgentFees = apportionDeduction(totalAgentFees, apportionment);
  const apportionedOperatingExpenses = apportionDeduction(
    grossOperatingExpenses,
    apportionment,
  );
  const apportionedInterest = apportionDeduction(
    confirmedInterest,
    apportionment,
  );

  const netRentalIncome =
    apportionedIncome != null
      ? apportionedIncome -
        apportionedAgentFees -
        apportionedOperatingExpenses -
        apportionedInterest
      : null;

  // Resolve effective classification for each expense and generate signed URLs
  const repairs: TaxExpense[] = [];
  const initialRepairs: TaxExpense[] = [];
  const capitalImprovements: TaxExpense[] = [];

  for (const renovation of renovations ?? []) {
    for (const expense of renovation.expenses ?? []) {
      if (expense.expense_date < fyStartStr || expense.expense_date > fyEndStr)
        continue;

      // The manual and renovation columns use different enum vocabularies;
      // resolving them here previously compared the inherited renovation value
      // against the tax vocabulary, so it never matched and every unoverridden
      // capital improvement was reported as a deductible repair.
      const effectiveClassification = resolveTaxClassification(
        expense.manual_classification,
        renovation.classification,
      );

      let invoice_url: string | null = null;
      if (expense.invoice_path) {
        const { data: signed } = await supabase.storage
          .from("invoices")
          .createSignedUrl(expense.invoice_path, 3600);
        invoice_url = signed?.signedUrl ?? null;
      }

      const taxExpense: TaxExpense = {
        id: expense.id,
        expense_date: expense.expense_date,
        supplier: expense.supplier,
        abn: (expense as { abn?: string | null }).abn ?? null,
        category: expense.category,
        amount: Number(expense.amount),
        gst_amount:
          (expense as { gst_amount?: number | null }).gst_amount != null
            ? Number((expense as { gst_amount?: number | null }).gst_amount)
            : null,
        description: expense.description,
        classification: effectiveClassification,
        invoice_url,
        renovation_name: renovation.name,
        renovation_description:
          (renovation as { description?: string | null }).description ?? null,
      };

      if (effectiveClassification === "Capital Works") {
        capitalImprovements.push(taxExpense);
      } else if (effectiveClassification === "Immediate Repair") {
        initialRepairs.push(taxExpense);
      } else {
        repairs.push(taxExpense);
      }
    }
  }

  // Sort each group by date ascending
  const byDate = (a: TaxExpense, b: TaxExpense) =>
    a.expense_date.localeCompare(b.expense_date);
  repairs.sort(byDate);
  initialRepairs.sort(byDate);
  capitalImprovements.sort(byDate);

  // Generate signed URLs for rental expense invoices
  const rentalExpensesWithUrls = await Promise.all(
    (rentalExpenses ?? []).map(async (e) => {
      if (!e.invoice_path) return { ...e, invoice_url: null };
      const { data: signed } = await supabase.storage
        .from("invoices")
        .createSignedUrl(e.invoice_path, 3600);
      return { ...e, invoice_url: signed?.signedUrl ?? null };
    }),
  );

  // Capital works items for the Div 43 register, and the QS figures for Div 40.
  const [{ data: capitalWorksRows }, { data: depreciationReport }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select(
          "id, amount, description, capital_works_start_date, capital_works_rate_pct, renovations!inner(property_id, claimable)",
        )
        .eq("renovations.property_id", propertyId)
        .eq("renovations.claimable", true)
        .not("capital_works_start_date", "is", null),
      supabase
        .from("depreciation_reports")
        .select("*")
        .eq("property_id", propertyId)
        .eq("financial_year_end", selectedFyEndYear)
        .maybeSingle(),
    ]);

  // Each item runs its own 40-year clock from its completion date.
  const div43Register = div43RegisterForFy(
    (capitalWorksRows ?? []).map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      startDate: row.capital_works_start_date,
      ratePct: Number(row.capital_works_rate_pct),
      description: row.description,
    })),
    selectedFyEndYear,
    fyStartMonth,
    fyStartDay,
  );

  // Prefer the recorded purchase cost over the ROI calculator's planning input,
  // and carry the source through so the report can label an estimate as one.
  const resolvedStampDuty: TaxReportData["stampDuty"] =
    property.stamp_duty != null
      ? { amount: Number(property.stamp_duty), source: "property" }
      : roiInputs?.stamp_duty != null
        ? { amount: Number(roiInputs.stamp_duty), source: "roi_inputs" }
        : { amount: 0, source: null };

  const reportData: TaxReportData = {
    property,
    roiInputs: roiInputs ?? null,
    stampDuty: resolvedStampDuty,
    income: {
      source: income.source,
      actual: income.actual,
      accrued: income.accrued,
      materialDivergence: income.materialDivergence,
    },
    financialYear,
    totalRentalIncome: apportionedIncome,
    totalAgentFees: apportionedAgentFees,
    totalOperatingExpenses: apportionedOperatingExpenses,
    totalLoanInterest: apportionedInterest,
    netRentalIncome,
    apportionment: {
      ownershipPct: apportionment.ownershipFraction * 100,
      deductibleDayPct: apportionment.deductibleDayFraction * 100,
      assumedSoleOwnership: apportionment.assumedSoleOwnership,
      assumedFullYear: apportionment.assumedFullYear,
    },
    rentalExpenses: rentalExpensesWithUrls,
    repairs,
    initialRepairs,
    capitalImprovements,
    generatedAt: new Date().toLocaleString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  // ── Downloadable pack, scoped to this property ────────────────────────────
  // The page already holds every figure; the pack turns them into a file the
  // owner forwards to their accountant, with the evidence embedded.

  const schedule = buildRentalSchedule({
    propertyType: property.property_type,
    grossRent: income.amount,
    agentFees: totalAgentFees,
    operatingExpenses: (rentalExpenses ?? []).map((e) => ({
      category: e.category,
      amount: Number(e.amount),
    })),
    renovationExpenses: (renovations ?? []).flatMap((r) =>
      (r.expenses ?? [])
        .filter(
          (e) =>
            e.expense_date >= fyStartStr && e.expense_date <= fyEndStr,
        )
        .map((e) => ({
          amount: Number(e.amount),
          manual_classification: e.manual_classification,
          renovation_classification: r.classification,
          claimable: r.claimable ?? true,
        })),
    ),
    interest: confirmedInterest,
    capitalWorks:
      depreciationReport?.div43_annual != null
        ? Number(depreciationReport.div43_annual)
        : div43Register.totalClaim,
    declineInValue:
      depreciationReport?.div40_annual != null
        ? Number(depreciationReport.div40_annual)
        : null,
    apportionment,
  });

  const packOmissions: string[] = [];
  const unconfirmedStatements = (loanStatements ?? []).filter(
    (s) => s.confirmed_at == null,
  ).length;
  if (unconfirmedStatements > 0) {
    packOmissions.push(
      `${unconfirmedStatements} loan statement(s) awaiting confirmation are excluded from the interest claimed.`,
    );
  }
  if (div43Register.itemsMissingStartDate > 0) {
    packOmissions.push(
      `${div43Register.itemsMissingStartDate} capital works item(s) have no completion date, so no Division 43 deduction is claimed for them.`,
    );
  }

  // Evidence: signed once here, fetched and embedded during generation.
  const evidence: EvidenceItem[] = [];
  const signedFor = async (bucket: string, path: string) => {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    return data?.signedUrl ?? null;
  };

  for (const renovation of renovations ?? []) {
    if (renovation.claimable === false) continue;
    for (const expense of renovation.expenses ?? []) {
      if (!expense.invoice_path) continue;
      if (expense.expense_date < fyStartStr || expense.expense_date > fyEndStr)
        continue;
      const resolved = resolveTaxClassification(
        expense.manual_classification,
        renovation.classification,
      );
      evidence.push({
        fileName: `${safeFileName(
          `${expense.expense_date}-${expense.supplier ?? "expense"}-${expense.id.slice(0, 8)}`,
        )}.${expense.invoice_path.split(".").pop() ?? "pdf"}`,
        signedUrl: await signedFor("invoices", expense.invoice_path),
        propertyAddress: property.address,
        kind: "Invoice",
        description: expense.description ?? renovation.name,
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

  for (const expense of rentalExpenses ?? []) {
    if (!expense.invoice_path) continue;
    evidence.push({
      fileName: `${safeFileName(
        `${expense.expense_date}-${expense.category}-${expense.id.slice(0, 8)}`,
      )}.${expense.invoice_path.split(".").pop() ?? "pdf"}`,
      signedUrl: await signedFor("invoices", expense.invoice_path),
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
    evidence.push({
      fileName: `loan-statement-${safeFileName(statement.account_ref ?? statement.id.slice(0, 8))}.pdf`,
      signedUrl: await signedFor("property-files", statement.storage_path),
      propertyAddress: property.address,
      kind: "Loan statement",
      description: `${statement.lender ?? "Lender"} annual statement`,
      date: statement.period_end,
      amount:
        statement.interest_paid != null ? Number(statement.interest_paid) : null,
      feedsLine: "Interest on loans",
    });
  }

  if (depreciationReport?.storage_path) {
    evidence.push({
      fileName: "depreciation-schedule.pdf",
      signedUrl: await signedFor(
        "property-files",
        depreciationReport.storage_path,
      ),
      propertyAddress: property.address,
      kind: "Depreciation schedule",
      description: `${depreciationReport.qs_firm ?? "Quantity surveyor"} schedule`,
      date: depreciationReport.report_date,
      amount: null,
      feedsLine: "Decline in value / capital works",
    });
  }

  // Lifetime totals, NOT the selected year's. The display arrays above are
  // filtered to the reported year; the cost base must not be, or it
  // understates the base and overstates a future capital gain.
  const { initialRepairs: initialRepairTotal, capitalImprovements: capitalImprovementTotal } =
    capitalTotalsForCostBase(
      (renovations ?? []).map((r) => ({
        classification: r.classification,
        claimable: r.claimable,
        expenses: (r.expenses ?? []).map((e) => ({
          amount: Number(e.amount),
          manual_classification: e.manual_classification,
        })),
      })),
    );
  const packCostBase = {
    purchasePrice: Number(property.purchase_price ?? 0),
    stampDuty: resolvedStampDuty.amount,
    stampDutySource: resolvedStampDuty.source,
    initialRepairs: initialRepairTotal,
    capitalImprovements: capitalImprovementTotal,
    total:
      Number(property.purchase_price ?? 0) +
      resolvedStampDuty.amount +
      initialRepairTotal +
      capitalImprovementTotal,
  };

  const packData: PackData = {
    taxpayerName: profile?.display_name ?? user.email ?? "Property owner",
    financialYearLabel: financialYear,
    fyStartDate: fyStartStr,
    fyEndDate: fyEndStr,
    generatedAt: reportData.generatedAt,
    properties: [
      {
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
        apportionment: reportData.apportionment,
        div43Items: div43Register.items,
        div43Total:
          depreciationReport?.div43_annual != null
            ? Number(depreciationReport.div43_annual)
            : div43Register.totalClaim,
        div40Annual:
          depreciationReport?.div40_annual != null
            ? Number(depreciationReport.div40_annual)
            : null,
        depreciationMethod: depreciationReport?.depreciation_method ?? null,
        qsFirm: depreciationReport?.qs_firm ?? null,
        costBase: packCostBase,
      },
    ],
    portfolio: {
      totalGrossRent: schedule.grossRent,
      deductionTotals: schedule.deductions,
      totalDeductions: schedule.totalDeductions,
      netResult: schedule.netResult,
      isLoss: schedule.isLoss,
      propertiesAtLoss: schedule.isLoss ? 1 : 0,
      totalCostBase: packCostBase.total,
    },
    excluded: schedule.excludedReason
      ? [{ address: property.address, reason: schedule.excludedReason }]
      : [],
    questionnaire: buildQuestionnaire({
      financialYearLabel: financialYear,
      properties: [
        {
          address: property.address,
          grossRent: schedule.grossRent,
          netResult: schedule.netResult,
          isLoss: schedule.isLoss,
          incomeSource: income.source,
          ownershipPct: reportData.apportionment.ownershipPct,
          assumedSoleOwnership: reportData.apportionment.assumedSoleOwnership,
          hasConfirmedInterest: confirmedInterest > 0,
          hasDepreciationSchedule: depreciationReport != null,
          purchaseDate: property.purchase_date,
          excluded: schedule.excludedReason != null,
        },
      ],
      purchasedDuringYear:
        property.purchase_date &&
        property.purchase_date >= fyStartStr &&
        property.purchase_date <= fyEndStr
          ? [property.address]
          : [],
    }),
    omissions: packOmissions,
  };

  const propertyAddress = [property.address, property.suburb, property.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "Properties", href: "/properties" },
            { label: property.address, href: `/properties/${propertyId}` },
            { label: "Tax pack" },
          ]}
        />
        <FinancialYearSelect
          options={yearOptions}
          selected={selectedFyEndYear}
        />
      </div>

      <div className="mb-6">
        <PropertyFyFactsPanel
          propertyId={propertyId}
          financialYearEnd={selectedFyEndYear}
          financialYearLabel={financialYear}
          facts={fyFacts ?? null}
          daysInYear={daysInYear}
          fyStartDate={fyStartStr}
          fyEndDate={fyEndStr}
          fyStartMonth={fyStartMonth}
          fyStartDay={fyStartDay}
          suggestion={availabilitySuggestion}
        />
      </div>

      <div className="mb-6">
        <LoanStatementsPanel
          propertyId={propertyId}
          financialYearEnd={selectedFyEndYear}
          financialYearLabel={financialYear}
          statements={loanStatements ?? []}
          estimate={interestEstimate}
        />
      </div>

      <div className="mb-6">
        <DepreciationReportPanel
          propertyId={propertyId}
          userId={user.id}
          financialYearEnd={selectedFyEndYear}
          financialYearLabel={financialYear}
          report={depreciationReport ?? null}
          registerCapitalWorks={div43Register.totalClaim}
        />
      </div>

      <div className="mb-6">
        <TaxPackGenerator data={packData} evidence={evidence} />
      </div>

      <TaxReport
        data={reportData}
        xeroConnection={
          xeroConnection
            ? {
                tenantId: xeroConnection.tenant_id,
                tenantName: xeroConnection.tenant_name,
                propertyId,
                propertyAddress,
                fyStart: fyStartStr,
                fyEnd: fyEndStr,
                financialYear,
              }
            : undefined
        }
      />
    </div>
  );
}
