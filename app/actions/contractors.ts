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

  // Only fill in fields that are currently blank — never overwrite known data
  function merge<T>(existing: T | null, incoming: T | null | undefined): T | null {
    return existing ?? incoming ?? null;
  }

  let contractorId: string | null = null;

  // 1. Match globally by ABN (authoritative dedup key)
  if (cleanAbn) {
    const { data: byAbn } = await supabase
      .from("contractors")
      .select("id, phone, email, website, address, suburb, state, postcode")
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

  // 2. Match by name within this user's existing contractors
  if (!contractorId) {
    const { data: userLinks } = await supabase
      .from("user_contractors")
      .select("contractor_id")
      .eq("user_id", user.id);

    const userContractorIds = (userLinks ?? []).map((l) => l.contractor_id);

    if (userContractorIds.length > 0) {
      const { data: byName } = await supabase
        .from("contractors")
        .select("id, phone, email, website, address, suburb, state, postcode, abn")
        .in("id", userContractorIds)
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
  }

  // 3. Create new global contractor record
  if (!contractorId) {
    const { data: created, error } = await supabase
      .from("contractors")
      .insert({
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

    if (error && cleanAbn) {
      // Race condition: another user inserted the same ABN — find it
      const { data: existing } = await supabase
        .from("contractors")
        .select("id")
        .eq("abn", cleanAbn)
        .maybeSingle();
      contractorId = existing?.id ?? null;
    } else {
      contractorId = created?.id ?? null;
    }
  }

  if (!contractorId) return;

  // 4. Ensure the user has a link to this contractor
  await supabase
    .from("user_contractors")
    .upsert(
      { user_id: user.id, contractor_id: contractorId },
      { onConflict: "user_id,contractor_id", ignoreDuplicates: true },
    );

  // 5. Link contractor to the expense
  await supabase
    .from("expenses")
    .update({ contractor_id: contractorId })
    .eq("id", expenseId);

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
