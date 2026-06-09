"use server";

import { createClient } from "@/lib/supabase/server";

export async function createExpenseFromInvoice(input: {
  renovationId: string;
  amount: number;
  gst_amount?: number | null;
  expense_date: string;
  description?: string | null;
  supplier?: string | null;
  abn?: string | null;
  context_notes?: string | null;
  raw_text?: string | null;
}): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      renovation_id: input.renovationId,
      amount: input.amount,
      gst_amount: input.gst_amount ?? null,
      expense_date: input.expense_date,
      description: input.description ?? null,
      supplier: input.supplier ?? null,
      abn: input.abn ?? null,
      context_notes: input.context_notes ?? null,
      raw_text: input.raw_text ?? null,
      category: "other",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}
