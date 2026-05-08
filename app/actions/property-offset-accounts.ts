"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface OffsetAccountInput {
  label: string;
  balance: number;
}

export async function saveOffsetAccounts(
  propertyId: string,
  accounts: OffsetAccountInput[],
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error: deleteError } = await supabase
    .from("property_offset_accounts")
    .delete()
    .eq("property_id", propertyId);
  if (deleteError) throw deleteError;

  const valid = accounts.filter((a) => a.label.trim() && a.balance >= 0);
  if (valid.length > 0) {
    const { error: insertError } = await supabase
      .from("property_offset_accounts")
      .insert(
        valid.map((a) => ({
          property_id: propertyId,
          label: a.label.trim(),
          balance: a.balance,
        })),
      );
    if (insertError) throw insertError;
  }

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/financial");
}
