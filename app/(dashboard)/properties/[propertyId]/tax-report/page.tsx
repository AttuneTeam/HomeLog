import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TaxReport } from "@/components/tax-report";
import type { TaxExpense, TaxReportData } from "@/components/tax-report";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function TaxReportPage({ params }: Props) {
  const { propertyId } = await params;
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

  // Fetch ROI calculator inputs, rental periods, and profile in parallel
  const [{ data: roiInputs }, { data: rentalPeriods }, { data: profile }] =
    await Promise.all([
      supabase
        .from("roi_calculator_inputs")
        .select(
          "stamp_duty, weekly_rent, div43_depreciation, div40_depreciation",
        )
        .eq("user_id", user.id)
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
    ]);

  // Financial year bounds derived from user profile (month is 1-based in DB)
  const fyStartMonth = (profile?.financial_year_start_month ?? 7) - 1; // 0-based
  const fyStartDay = profile?.financial_year_start_day ?? 1;
  const today = new Date();
  const fyStartYear =
    today.getMonth() > fyStartMonth ||
    (today.getMonth() === fyStartMonth && today.getDate() >= fyStartDay)
      ? today.getFullYear()
      : today.getFullYear() - 1;
  const fyStart = new Date(fyStartYear, fyStartMonth, fyStartDay);
  const fyEnd = new Date(fyStartYear + 1, fyStartMonth, fyStartDay - 1);
  const fyStartStr = fyStart.toISOString().slice(0, 10);
  const fyEndStr = fyEnd.toISOString().slice(0, 10);
  const financialYear = `${fyStartYear}–${String(fyStartYear + 1).slice(2)}`;

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
    const end = new Date(
      Math.min(
        (period.end_date ? new Date(period.end_date) : today).getTime(),
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

      const effectiveClassification =
        expense.manual_classification ?? renovation.classification;

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

  const reportData: TaxReportData = {
    property,
    roiInputs: roiInputs ?? null,
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

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-6">
        <Link href="/properties" className="hover:underline">
          Properties
        </Link>
        <span>/</span>
        <Link href={`/properties/${propertyId}`} className="hover:underline">
          {property.address}
        </Link>
        <span>/</span>
        <span>Tax Report</span>
      </div>

      <TaxReport data={reportData} />
    </div>
  );
}
