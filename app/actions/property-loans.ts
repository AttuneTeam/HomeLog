"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Save the loan terms for a property.
 *
 * `startDate` is the drawdown date. Without it the interest estimate assumes
 * the loan ran for the whole financial year, which overstates the first year of
 * a mid-year loan by however much of the year preceded it.
 */
export async function saveLoanDetails(
  propertyId: string,
  loanAmount: number,
  loanTermYears: number,
  startDate?: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("property_loans").upsert(
    {
      property_id: propertyId,
      loan_amount: loanAmount,
      loan_term_years: loanTermYears,
      start_date: startDate ?? null,
    },
    { onConflict: "property_id" },
  );
  if (error) throw error;

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/tax-report`);
  revalidatePath("/financial");
}
