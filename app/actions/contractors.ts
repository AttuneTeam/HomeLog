"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ContractorInput = {
  name: string;
  abn?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
};

export async function upsertContractorFromExpense(
  expenseId: string,
  input: ContractorInput,
): Promise<void> {
  if (!input.name?.trim()) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const cleanAbn = input.abn?.replace(/\s/g, "") || null;
  const name = input.name.trim();

  // Merge helper: only overwrite nulls/blanks with new data
  function merge<T>(existing: T | null, incoming: T | null | undefined): T | null {
    return existing ?? incoming ?? null;
  }

  let contractorId: string | null = null;

  // 1. Try match by ABN
  if (cleanAbn) {
    const { data: byAbn } = await supabase
      .from("contractors")
      .select("id, name, phone, email, website, address, suburb, state, postcode")
      .eq("user_id", user.id)
      .eq("abn", cleanAbn)
      .maybeSingle();

    if (byAbn) {
      contractorId = byAbn.id;
      await supabase
        .from("contractors")
        .update({
          phone: merge(byAbn.phone, input.phone),
          email: merge(byAbn.email, input.email),
          website: merge(byAbn.website, input.website),
          address: merge(byAbn.address, input.address),
          suburb: merge(byAbn.suburb, input.suburb),
          state: merge(byAbn.state, input.state),
          postcode: merge(byAbn.postcode, input.postcode),
        })
        .eq("id", contractorId);
    }
  }

  // 2. Try match by name (case-insensitive)
  if (!contractorId) {
    const { data: byName } = await supabase
      .from("contractors")
      .select("id, phone, email, website, address, suburb, state, postcode, abn")
      .eq("user_id", user.id)
      .ilike("name", name)
      .maybeSingle();

    if (byName) {
      contractorId = byName.id;
      await supabase
        .from("contractors")
        .update({
          abn: merge(byName.abn, cleanAbn),
          phone: merge(byName.phone, input.phone),
          email: merge(byName.email, input.email),
          website: merge(byName.website, input.website),
          address: merge(byName.address, input.address),
          suburb: merge(byName.suburb, input.suburb),
          state: merge(byName.state, input.state),
          postcode: merge(byName.postcode, input.postcode),
        })
        .eq("id", contractorId);
    }
  }

  // 3. Create new contractor
  if (!contractorId) {
    const { data: created } = await supabase
      .from("contractors")
      .insert({
        user_id: user.id,
        name,
        abn: cleanAbn,
        phone: input.phone || null,
        email: input.email || null,
        website: input.website || null,
        address: input.address || null,
        suburb: input.suburb || null,
        state: input.state || null,
        postcode: input.postcode || null,
      })
      .select("id")
      .single();

    contractorId = created?.id ?? null;
  }

  // 4. Link contractor to the expense
  if (contractorId) {
    await supabase
      .from("expenses")
      .update({ contractor_id: contractorId })
      .eq("id", expenseId);
  }

  revalidatePath("/contractors");
}

export async function updateRenovationSummary(
  renovationId: string,
  summaryText: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("renovation_summaries")
    .update({ summary_text: summaryText, is_edited: true })
    .eq("renovation_id", renovationId);

  if (error) throw error;
}

export async function updateExpenseValueSummary(
  expenseId: string,
  summaryText: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("expense_value_summaries")
    .update({ summary_text: summaryText, is_edited: true })
    .eq("expense_id", expenseId);

  if (error) throw error;
}
