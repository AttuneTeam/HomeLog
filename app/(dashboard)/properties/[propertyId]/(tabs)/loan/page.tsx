import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Banknote } from "lucide-react";
import { LoanInterestRatesSection } from "@/components/loan-interest-rates-section";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function LoanTab({ params }: Props) {
  const { propertyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await supabase
    .from("properties")
    .select("id, property_type")
    .eq("id", propertyId)
    .single();
  if (!property) notFound();

  if (property.property_type === "primary_residence") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center gap-3">
        <Banknote className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Loan tracking is only available for investment properties
        </p>
      </div>
    );
  }

  const [{ data: loanRates }, { data: propertyLoan }, { data: offsetAccounts }] =
    await Promise.all([
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

  return (
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
  );
}
