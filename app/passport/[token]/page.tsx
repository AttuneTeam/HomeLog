import { notFound } from "next/navigation";
import { Home } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import {
  PropertyHistoryTimeline,
  type TimelineEvent,
  type HistorySummary,
} from "@/components/property-history-timeline";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PassportPage({ params }: Props) {
  const { token } = await params;
  const admin = createAdminClient();

  // Resolve token
  const { data: link } = await admin
    .from("property_passport_links")
    .select("property_id, expires_at")
    .eq("share_token", token)
    .maybeSingle();

  if (!link) notFound();

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <div className="text-center space-y-2">
          <p className="font-medium">This passport link has expired.</p>
          <p className="text-sm text-muted-foreground">
            Ask the property owner to generate a new link.
          </p>
        </div>
      </div>
    );
  }

  const propertyId = link.property_id;

  const [
    { data: property },
    { data: renovations },
    { data: propertyFiles },
    { data: rentalPeriods },
    { data: rentalExpenses },
    { data: loanRates },
  ] = await Promise.all([
    admin.from("properties").select("*").eq("id", propertyId).single(),
    admin
      .from("renovations")
      .select("*, expenses(id, description, expense_date, amount, category, supplier, abn, invoice_path, manual_classification)")
      .eq("property_id", propertyId)
      .order("start_date", { ascending: false }),
    admin
      .from("property_files")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    admin
      .from("rental_periods")
      .select("*")
      .eq("property_id", propertyId)
      .order("start_date", { ascending: true }),
    admin
      .from("rental_operating_expenses")
      .select("*")
      .eq("property_id", propertyId)
      .order("expense_date", { ascending: false }),
    admin
      .from("loan_interest_rates")
      .select("id, property_id, rate, effective_date, notes")
      .eq("property_id", propertyId)
      .order("effective_date", { ascending: true }),
  ]);

  if (!property) notFound();

  const events: TimelineEvent[] = [];

  if (property.purchase_date) {
    events.push({
      id: `purchase-${property.id}`,
      sortDate: property.purchase_date,
      displayDate: property.purchase_date,
      type: "purchase",
      title: "Property purchased",
      subtitle: property.address,
      amount: null,
    });
  }

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
    events.push({
      id: `renovation-${r.id}`,
      sortDate: date,
      displayDate: date,
      type: "renovation",
      title: r.name,
      subtitle: r.contractor ? `Contractor: ${r.contractor}` : null,
      amount: null,
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

  for (const p of rentalPeriods ?? []) {
    events.push({
      id: `rental-start-${p.id}`,
      sortDate: p.start_date,
      displayDate: p.start_date,
      type: "rental_start",
      title: "Tenancy began",
      subtitle: p.management_company ?? null,
      amount: null,
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

  for (const e of rentalExpenses ?? []) {
    events.push({
      id: `maintenance-${e.id}`,
      sortDate: e.expense_date,
      displayDate: e.expense_date,
      type: "maintenance",
      title: e.description ?? e.category,
      subtitle: e.supplier ?? null,
      amount: null,
      maintenance: {
        category: e.category,
        supplier: e.supplier,
        abn: e.abn,
        invoicePath: e.invoice_path,
      },
    });
  }

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
      document: { storagePath: f.storage_path },
    });
  }

  for (const r of loanRates ?? []) {
    events.push({
      id: `rate-${r.id}`,
      sortDate: r.effective_date,
      displayDate: r.effective_date,
      type: "rate_change",
      title: `Interest rate changed to ${r.rate}%`,
      subtitle: r.notes ?? null,
      amount: null,
      rateChange: { rate: Number(r.rate), notes: r.notes },
    });
  }

  events.sort((a, b) => b.sortDate.localeCompare(a.sortDate));

  const completedRenovations = (renovations ?? []).filter((r) => r.status === "completed");
  const earliestRentalDate = (rentalPeriods ?? []).map((p) => p.start_date).sort()[0];
  const rentalYears = earliestRentalDate
    ? Math.floor((Date.now() - new Date(earliestRentalDate).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  const summary: HistorySummary = {
    capitalInvested: 0,
    maintenanceSpend: 0,
    renovationsCompleted: completedRenovations.length,
    rentalYears,
  };

  const locationParts = [property.suburb, property.state, property.postcode].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center gap-2">
        <Home className="h-5 w-5" />
        <span className="font-bold text-lg tracking-tight">Home Base</span>
        <span className="ml-2 text-xs text-muted-foreground rounded-full border px-2 py-0.5">
          Property Passport
        </span>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{property.address}</h1>
          {locationParts.length > 0 && (
            <p className="text-muted-foreground text-sm mt-1">
              {locationParts.join(", ")}
            </p>
          )}
        </div>

        <PropertyHistoryTimeline events={events} summary={summary} />

        <footer className="pt-4 border-t text-center text-xs text-muted-foreground">
          This property passport was shared via{" "}
          <span className="font-medium">Home Base</span>. Financial amounts have
          been hidden from the public view.
        </footer>
      </div>
    </div>
  );
}
