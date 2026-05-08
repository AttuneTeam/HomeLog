"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveLoanDetails(
  propertyId: string,
  loanAmount: number,
  loanTermYears: number,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("property_loans").upsert(
    { property_id: propertyId, loan_amount: loanAmount, loan_term_years: loanTermYears },
    { onConflict: "property_id" },
  );
  if (error) throw error;

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/financial");
}
