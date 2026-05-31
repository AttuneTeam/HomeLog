import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, calcTotalSpend } from "@/lib/utils";
import {
  Plus,
  Pencil,
  MapPin,
  Calendar,
  DollarSign,
  Wrench,
  FileBarChart,
  History,
  StickyNote,
  Home,
  HardHat,
} from "lucide-react";
import { DeletePropertyButton } from "@/components/delete-property-button";
import { PropertySharePanel } from "@/components/property-share-panel";
import { PropertyFilesSection } from "@/components/property-files-section";
import { RentalPeriodsSection } from "@/components/rental-periods-section";
import { RentalExpensesSection } from "@/components/rental-expenses-section";
import { LoanInterestRatesSection } from "@/components/loan-interest-rates-section";
import { RenovationsList } from "@/components/renovations-list";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function PropertyDetailPage({ params }: Props) {
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
    { data: propertyLoan },
    { data: offsetAccounts },
  ] = await Promise.all([
    supabase
      .from("renovations")
      .select(
        "*, expenses(id, description, expense_date, amount, manual_classification, supplier)",
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
      .from("property_loans")
      .select("loan_amount, loan_term_years")
      .eq("property_id", propertyId)
      .maybeSingle(),
    supabase
      .from("property_offset_accounts")
      .select("id, label, balance")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true }),
  ]);

  // Fetch contractor data for this property's renovations
  const renovationIds = (renovations ?? []).map((r) => r.id);
  const { data: propertyExpensesWithContractors } =
    renovationIds.length > 0
      ? await supabase
          .from("expenses")
          .select("amount, contractor_id, contractors(id, name, abn, suburb, state, trade_category)")
          .in("renovation_id", renovationIds)
          .not("contractor_id", "is", null)
      : { data: null };

  const totalSpend = calcTotalSpend(renovations ?? []);

  // Aggregate per-property contractors: deduplicate by contractor id
  type ContractorSummary = {
    id: string;
    name: string;
    abn: string | null;
    suburb: string | null;
    state: string | null;
    trade_category: string | null;
    total: number;
  };
  type ExpenseWithContractor = {
    amount: number;
    contractor_id: string | null;
    contractors: Omit<ContractorSummary, "total"> | null;
  };
  const contractorMap = new Map<string, ContractorSummary>();
  for (const row of (propertyExpensesWithContractors ?? []) as ExpenseWithContractor[]) {
    const c = row.contractors;
    if (!c) continue;
    if (!contractorMap.has(c.id)) {
      contractorMap.set(c.id, { ...c, total: 0 });
    }
    contractorMap.get(c.id)!.total += Number(row.amount);
  }
  const propertyContractors = Array.from(contractorMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const capitalTotal =
    renovations?.reduce((sum, r) => {
      if (r.status === "planned" || r.claimable === false) return sum;
      const rTotal =
        r.expenses?.reduce(
          (
            s: number,
            e: { amount: number; manual_classification: string | null },
          ) => {
            const cls = e.manual_classification;
            return cls === "Capital Works" ? s + Number(e.amount) : s;
          },
          0,
        ) ?? 0;
      return sum + rTotal;
    }, 0) ?? 0;

  const adjustedCostBase =
    (property.purchase_price ?? 0) + (property.stamp_duty ?? 0) + capitalTotal;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/properties" className="hover:underline">
              Properties
            </Link>
            <span>/</span>
          </div>
          <h1 className="text-2xl font-bold">{property.address}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {(property.suburb || property.state) && (
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <MapPin className="h-3.5 w-3.5" />
                {[property.suburb, property.state, property.postcode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${property.property_type === "primary_residence" ? "bg-violet-100 text-violet-800" : "bg-emerald-100 text-emerald-800"}`}
            >
              {property.property_type === "primary_residence"
                ? "Primary Residence"
                : "Investment"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <ButtonLink
            href={`/properties/${propertyId}/history`}
            variant="outline"
            size="sm"
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            History
          </ButtonLink>
          <ButtonLink
            href={`/properties/${propertyId}/tax-report`}
            variant="outline"
            size="sm"
          >
            <FileBarChart className="h-3.5 w-3.5 mr-1.5" />
            Tax Report
          </ButtonLink>
          {property.user_id === user.id && (
            <>
              <Separator orientation="vertical" className="h-6" />
              <PropertySharePanel propertyId={propertyId} />
              <ButtonLink
                href={`/properties/${propertyId}/edit`}
                variant="outline"
                size="sm"
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </ButtonLink>
              <DeletePropertyButton propertyId={propertyId} />
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Purchased
            </p>
            <p className="font-semibold mt-1">
              {formatDate(property.purchase_date)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Purchase price
            </p>
            <p className="font-semibold mt-1">
              {formatCurrency(property.purchase_price)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Total spend
            </p>
            <p className="font-semibold mt-1">{formatCurrency(totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Adjusted cost base</p>
            <p className="font-semibold mt-1">
              {formatCurrency(adjustedCostBase)}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              purchase + stamp duty + capital works
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-20">
        {/* Financing */}
        {property.property_type !== "primary_residence" && (
          <LoanInterestRatesSection
            propertyId={propertyId}
            initialRates={(loanRates ?? []).map((r) => ({
              id: r.id,
              property_id: r.property_id,
              rate: Number(r.rate),
              effective_date: r.effective_date,
              notes: r.notes,
            }))}
            initialLoan={
              propertyLoan
                ? {
                    loan_amount: Number(propertyLoan.loan_amount),
                    loan_term_years: propertyLoan.loan_term_years,
                  }
                : null
            }
            initialOffsets={(offsetAccounts ?? []).map((o) => ({
              id: o.id,
              label: o.label,
              balance: Number(o.balance),
            }))}
          />
        )}

        {/* Rent */}
        {property.property_type !== "primary_residence" && (
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <Home className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Rent</h2>
            </div>
            <Separator className="mb-6" />
            <div className="space-y-8">
              <RentalPeriodsSection
                propertyId={propertyId}
                initialPeriods={rentalPeriods ?? []}
              />
              <RentalExpensesSection
                propertyId={propertyId}
                userId={user.id}
                initialExpenses={rentalExpenses ?? []}
              />
            </div>
          </div>
        )}

        {/* Renovations & Capital Works */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Wrench className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Renovations</h2>
            </div>
            <ButtonLink
              href={`/properties/${propertyId}/renovations/new`}
              size="sm"
              variant="outline"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add renovation
            </ButtonLink>
          </div>
          <Separator className="mb-6" />

          {!renovations || renovations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center gap-3">
              <Wrench className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <p className="font-medium">No renovations yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Track your first renovation project
                </p>
              </div>
              <ButtonLink
                href={`/properties/${propertyId}/renovations/new`}
                variant="outline"
                size="sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add renovation
              </ButtonLink>
            </div>
          ) : (
            <RenovationsList
              renovations={renovations}
              propertyId={propertyId}
            />
          )}
        </div>

        {/* Contractors */}
        {propertyContractors.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <HardHat className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Contractors</h2>
              </div>
              <Link
                href="/contractors"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </Link>
            </div>
            <Separator className="mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {propertyContractors.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-[#E2E2E2] bg-white p-4 space-y-1"
                >
                  <p className="font-grotesk text-[14px] font-semibold text-[#030813]">
                    {c.name}
                  </p>
                  {c.trade_category && (
                    <p className="font-grotesk text-[12px] text-[#76777c]">
                      {c.trade_category}
                    </p>
                  )}
                  {(c.suburb || c.state) && (
                    <p className="font-grotesk text-[12px] text-[#76777c]">
                      {[c.suburb, c.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {c.abn && (
                    <p className="font-grotesk text-[11px] text-[#76777c]">
                      ABN {c.abn}
                    </p>
                  )}
                  <p className="font-grotesk text-[13px] font-medium text-[#030813] pt-1">
                    {formatCurrency(c.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents & Notes */}
        <div className="space-y-8">
          <PropertyFilesSection
            propertyId={propertyId}
            userId={user.id}
            initialFiles={propertyFiles ?? []}
          />

          {property.notes && (
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <StickyNote className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Notes</h2>
              </div>
              <Separator className="mb-6" />
              <Card>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {property.notes}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
