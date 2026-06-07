"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ExpenseFrequency = "monthly" | "quarterly" | "yearly";

export interface HouseholdExpenseInput {
  label: string;
  amount: number;
  frequency: ExpenseFrequency;
}

export async function saveHouseholdExpenses(
  financialYearEnd: number,
  expenses: HouseholdExpenseInput[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error: deleteError } = await supabase
    .from("household_expenses")
    .delete()
    .eq("user_id", user.id)
    .eq("financial_year_end", financialYearEnd);
  if (deleteError) throw deleteError;

  if (expenses.length > 0) {
    const { error: insertError } = await supabase
      .from("household_expenses")
      .insert(
        expenses.map((e, i) => ({
          user_id: user.id,
          label: e.label.trim() || "Expense",
          amount: e.amount,
          frequency: e.frequency,
          financial_year_end: financialYearEnd,
          sort_order: i,
        })),
      );
    if (insertError) throw insertError;
  }

  revalidatePath("/financial");
}
