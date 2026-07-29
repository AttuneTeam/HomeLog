import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { FinancialYearSelect } from "@/components/financial-year-select";
import { TaxReport } from "@/components/tax-report";
import type { TaxExpense, TaxReportData } from "@/components/tax-report";
import { resolveTaxClassification } from "@/lib/tax/classification";
import {
  AU_FY_START_DAY,
  AU_FY_START_MONTH,
  formatFyLabel,
  fyBounds,
  resolveFyEndYear,
  selectableFyEndYears,
} from "@/lib/tax/fy";

/** How many completed financial years to offer in the selector. */
const SELECTABLE_YEARS = 6;

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
      "id, address, suburb, state, postcode, purchase_date, purchase_price, stamp_duty",
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
        .select("financial_year_start_month, financial_year_start_day")
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

  // Fetch rental operating expenses now that FY dates are known
  const { data: rentalExpenses } = await supabase
    .from("rental_operating_expenses")
    .select("*")
    .eq("property_id", propertyId)
    .gte("expense_date", fyStartStr)
    .lte("expense_date", fyEndStr)
    .order("expense_date", { ascending: true });

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

  const totalRentalIncome =
    rentalPeriods && rentalPeriods.length > 0
      ? rentalPeriods.reduce((sum, period) => {
          const weeks = fyClampedWeeks(period);
          return sum + weeks * period.weekly_rent;
        }, 0)
      : null;

  const totalAgentFees =
    rentalPeriods?.reduce((sum, period) => {
      if (!period.management_fee_pct) return sum;
      const weeks = fyClampedWeeks(period);
      return sum + weeks * period.weekly_rent * (period.management_fee_pct / 100);
    }, 0) ?? 0;

  const totalOperatingExpenses =
    rentalExpenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;

  const netRentalIncome =
    totalRentalIncome != null
      ? totalRentalIncome - totalAgentFees - totalOperatingExpenses
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
    financialYear,
    totalRentalIncome,
    totalAgentFees,
    totalOperatingExpenses,
    netRentalIncome,
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
            { label: "Tax Report" },
          ]}
        />
        <FinancialYearSelect
          options={yearOptions}
          selected={selectedFyEndYear}
        />
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
