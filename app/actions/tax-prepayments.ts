"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveTaxPrepayment(financialYearEnd: number, amount: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("tax_prepayments").upsert(
    { user_id: user.id, financial_year_end: financialYearEnd, amount },
    { onConflict: "user_id,financial_year_end" },
  );
  if (error) throw error;

  revalidatePath("/financial");
}
