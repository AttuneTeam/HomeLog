import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Home } from "lucide-react";
import { RentalPeriodsSection } from "@/components/rental-periods-section";
import { RentalExpensesSection } from "@/components/rental-expenses-section";
import { RentalPaymentsSection, type RentalPayment } from "@/components/rental-payments-section";

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

  const [{ data: rentalPeriods }, { data: rentalExpenses }, { data: rentalPayments }] =
    await Promise.all([
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("rental_payments")
        .select("*")
        .eq("property_id", propertyId)
        .order("payment_date", { ascending: false }),
    ]);

  return (
    <div className="space-y-8">
      <RentalPeriodsSection propertyId={propertyId} initialPeriods={rentalPeriods ?? []} />
      <RentalPaymentsSection
        propertyId={propertyId}
        initialPayments={(rentalPayments ?? []) as unknown as RentalPayment[]}
      />
      <RentalExpensesSection
        propertyId={propertyId}
        userId={user.id}
        initialExpenses={rentalExpenses ?? []}
      />
    </div>
  );
}
