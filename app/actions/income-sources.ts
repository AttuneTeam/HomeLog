"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface IncomeSourceInput {
  label: string;
  amount: number;
}

export async function saveIncomeSources(sources: IncomeSourceInput[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error: deleteError } = await supabase
    .from("household_income_sources")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) throw deleteError;

  if (sources.length > 0) {
    const { error: insertError } = await supabase
      .from("household_income_sources")
      .insert(
        sources.map((s, i) => ({
          user_id: user.id,
          label: s.label.trim() || "Income",
          amount: s.amount,
          sort_order: i,
        })),
      );
    if (insertError) throw insertError;
  }

  revalidatePath("/financial");
}
