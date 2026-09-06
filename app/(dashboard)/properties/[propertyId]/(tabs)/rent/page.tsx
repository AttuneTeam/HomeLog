import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Home } from "lucide-react";
import { RentalPeriodsSection } from "@/components/rental-periods-section";
import { RentalExpensesSection } from "@/components/rental-expenses-section";
import { RentalPaymentsSection } from "@/components/rental-payments-section";
import { AU_FY_START_DAY, AU_FY_START_MONTH } from "@/lib/tax/fy";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function RentTab({ params }: Props) {
  const { propertyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await supabase
    .from("properties")
    .select("id, property_type, user_id")
    .eq("id", propertyId)
    .single();
  if (!property) notFound();

  if (property.property_type === "primary_residence") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center gap-3">
        <Home className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Rent tracking is only available for investment properties
        </p>
      </div>
    );
  }

  const [
    { data: rentalPeriods },
    { data: rentalExpenses },
    { data: rentalPayments },
    { data: profile },
  ] = await Promise.all([
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
      .from("rental_payments")
      .select("*")
      .eq("property_id", propertyId)
      .order("payment_date", { ascending: false }),
    supabase
      .from("profiles")
      .select("financial_year_start_month, financial_year_start_day")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // The financial-year boundary is the user's, not a constant. A user on a
  // non-July year would otherwise see this tab and their tax pack disagree
  // about which year a payment belongs to. Matches the tax-pack page.
  const fyStartMonth =
    profile?.financial_year_start_month ?? AU_FY_START_MONTH;
  const fyStartDay = profile?.financial_year_start_day ?? AU_FY_START_DAY;

  return (
    <div className="space-y-8">
      <RentalPeriodsSection
        propertyId={propertyId}
        initialPeriods={rentalPeriods ?? []}
        inboundDomain={process.env.INBOUND_EMAIL_DOMAIN ?? "mail.homebase.app"}
      />
      <RentalPaymentsSection
        propertyId={propertyId}
        initialPayments={rentalPayments ?? []}
        fyStartMonth={fyStartMonth}
        fyStartDay={fyStartDay}
      />
      <RentalExpensesSection
        propertyId={propertyId}
        userId={user.id}
        initialExpenses={rentalExpenses ?? []}
      />
    </div>
  );
}
