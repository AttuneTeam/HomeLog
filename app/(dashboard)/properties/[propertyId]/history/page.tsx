import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PropertyHistoryTimeline,
  type TimelineEvent,
  type HistorySummary,
} from "@/components/property-history-timeline";
import { PropertyEnrichmentSection, type PropertyEnrichment } from "@/components/property-enrichment-section";
import { Separator } from "@/components/ui/separator";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function PropertyHistoryPage({ params }: Props) {
  const { propertyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (!property) notFound();

  const [
    { data: renovations },
    { data: propertyFiles },
    { data: rentalPeriods },
    { data: rentalExpenses },
    { data: loanRates },
    { data: enrichment },
  ] = await Promise.all([
    supabase
      .from("renovations")
      .select(
        "*, expenses(id, description, expense_date, amount, category, supplier, abn, invoice_path, manual_classification)",
      )
      .eq("property_id", propertyId)
      .order("start_date", { ascending: false }),
    supabase
      .from("property_files")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("rental_periods")
      .select("*")
      .eq("property_id", propertyId)
      .order("start_date", { ascending: true }),
    supabase
      .from("rental_operating_expenses")
      .select("*")
      .eq("property_id", propertyId)
      .order("expense_date", { ascending: false }),
    supabase
      .from("loan_interest_rates")
      .select("id, property_id, rate, effective_date, notes")
      .eq("property_id", propertyId)
      .order("effective_date", { ascending: true }),
    supabase
      .from("property_enrichment")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle(),
  ]);

  const events: TimelineEvent[] = [];

  // Purchase
  if (property.purchase_date) {
    const total =
      (property.purchase_price ?? 0) + (property.stamp_duty ?? 0);
    events.push({
      id: `purchase-${property.id}`,
      sortDate: property.purchase_date,
      displayDate: property.purchase_date,
      type: "purchase",
      title: "Property purchased",
      subtitle: property.address,
      amount: total > 0 ? total : null,
    });
  }

  // Renovations
  for (const r of renovations ?? []) {
    const date = r.end_date ?? r.start_date;
    if (!date) continue;
    const expenses = (r.expenses ?? []).map(
      (e: {
        id: string;
        description: string | null;
        amount: number | string;
        category: string;
        supplier: string | null;
        abn: string | null;
        invoice_path: string | null;
        expense_date: string;
        manual_classification: string | null;
      }) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        category: e.category,
        supplier: e.supplier,
        abn: e.abn,
        invoicePath: e.invoice_path,
        expenseDate: e.expense_date,
        manualClassification: e.manual_classification,
      }),
    );
    const totalCost = expenses.reduce(
      (s: number, e: { amount: number }) => s + e.amount,
      0,
    );
    events.push({
      id: `renovation-${r.id}`,
      sortDate: date,
      displayDate: date,
      type: "renovation",
      title: r.name,
      subtitle: r.contractor ? `Contractor: ${r.contractor}` : null,
      amount: totalCost > 0 ? totalCost : null,
      renovation: {
        id: r.id,
        contractor: r.contractor,
        classification: r.classification,
        description: r.description,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
        notes: r.notes,
        expenses,
      },
    });
  }

  // Rental periods
  for (const p of rentalPeriods ?? []) {
    events.push({
      id: `rental-start-${p.id}`,
      sortDate: p.start_date,
      displayDate: p.start_date,
      type: "rental_start",
      title: "Tenancy began",
      subtitle: p.management_company ?? null,
      amount: Number(p.weekly_rent),
      rental: {
        weeklyRent: Number(p.weekly_rent),
        managementCompany: p.management_company,
        agentName: p.agent_name,
        endDate: p.end_date,
      },
    });
    if (p.end_date) {
      events.push({
        id: `rental-end-${p.id}`,
        sortDate: p.end_date,
        displayDate: p.end_date,
        type: "rental_end",
        title: "Tenancy ended",
        subtitle: p.management_company ?? null,
        amount: null,
        rental: {
          weeklyRent: Number(p.weekly_rent),
          managementCompany: p.management_company,
          agentName: p.agent_name,
          endDate: p.end_date,
        },
      });
    }
  }

  // Maintenance / rental operating expenses
  for (const e of rentalExpenses ?? []) {
    events.push({
      id: `maintenance-${e.id}`,
      sortDate: e.expense_date,
      displayDate: e.expense_date,
      type: "maintenance",
      title: e.description ?? e.category,
      subtitle: e.supplier ?? null,
      amount: Number(e.amount),
      maintenance: {
        category: e.category,
        supplier: e.supplier,
        abn: e.abn,
        invoicePath: e.invoice_path,
      },
    });
  }

  // Named property files only
  for (const f of propertyFiles ?? []) {
    if (!f.display_name) continue;
    events.push({
      id: `doc-${f.id}`,
      sortDate: f.created_at,
      displayDate: f.created_at,
      type: "document",
      title: f.display_name,
      subtitle: null,
      amount: null,
      document: {
        storagePath: f.storage_path,
      },
    });
  }

  // Loan interest rate changes
  for (const r of loanRates ?? []) {
    events.push({
      id: `rate-${r.id}`,
      sortDate: r.effective_date,
      displayDate: r.effective_date,
      type: "rate_change",
      title: `Interest rate changed to ${r.rate}%`,
      subtitle: r.notes ?? null,
      amount: null,
      rateChange: {
        rate: Number(r.rate),
        notes: r.notes,
      },
    });
  }

  // Sort newest first by default
  events.sort((a, b) => b.sortDate.localeCompare(a.sortDate));

  // Summary stats
  const completedRenovations = (renovations ?? []).filter(
    (r) => r.status === "completed",
  );
  const capitalInvested = completedRenovations.reduce((sum, r) => {
    return (
      sum +
      (r.expenses?.reduce(
        (s: number, e: { amount: number | string }) => s + Number(e.amount),
        0,
      ) ?? 0)
    );
  }, 0);
  const maintenanceSpend = (rentalExpenses ?? []).reduce(
    (sum, e) => sum + Number(e.amount),
    0,
  );
  const earliestRentalDate = (rentalPeriods ?? [])
    .map((p) => p.start_date)
    .sort()[0];
  const rentalYears = earliestRentalDate
    ? Math.floor(
        (Date.now() - new Date(earliestRentalDate).getTime()) /
          (1000 * 60 * 60 * 24 * 365),
      )
    : 0;

  const summary: HistorySummary = {
    capitalInvested,
    maintenanceSpend,
    renovationsCompleted: completedRenovations.length,
    rentalYears,
  };

  const locationParts = [property.suburb, property.state, property.postcode].filter(Boolean);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1 flex-wrap">
          <Link href="/properties" className="hover:underline">
            Properties
          </Link>
          <span>/</span>
          <Link
            href={`/properties/${propertyId}`}
            className="hover:underline truncate max-w-xs"
          >
            {property.address}
          </Link>
          <span>/</span>
          <span>History</span>
        </div>
        <h1 className="text-2xl font-bold">Property History</h1>
        {locationParts.length > 0 && (
          <p className="text-muted-foreground text-sm mt-1">
            {locationParts.join(", ")}
          </p>
        )}
      </div>

      <PropertyEnrichmentSection
        propertyId={propertyId}
        initial={enrichment ? {
          year_built: enrichment.year_built,
          architectural_style: enrichment.architectural_style,
          heritage_listing: enrichment.heritage_listing,
          heritage_description: enrichment.heritage_description,
          historical_context: enrichment.historical_context,
          notable_features: enrichment.notable_features ?? [],
          image_urls: enrichment.image_urls ?? [],
          sale_history: (enrichment.sale_history ?? []) as { year: string | null; price: string | null; type: string | null; notes: string | null }[],
          suburb_profile: enrichment.suburb_profile as PropertyEnrichment["suburb_profile"],
          street_and_council_history: enrichment.street_and_council_history ?? null,
          sources: (enrichment.sources ?? []) as { title: string; url: string }[],
          enriched_at: enrichment.enriched_at,
        } : null}
      />

      <Separator />

      <PropertyHistoryTimeline events={events} summary={summary} />
    </div>
  );
}
