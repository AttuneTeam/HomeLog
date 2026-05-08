"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addLoanInterestRate(
  propertyId: string,
  rate: number,
  effectiveDate: string,
  notes?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("loan_interest_rates").insert({
    property_id: propertyId,
    rate,
    effective_date: effectiveDate,
    notes: notes ?? null,
  });
  if (error) throw error;

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/financial");
}

export async function deleteLoanInterestRate(id: string, propertyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("loan_interest_rates")
    .delete()
    .eq("id", id);
  if (error) throw error;

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/financial");
}
