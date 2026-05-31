"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { HomeBaseCategory } from "@/lib/xero/categories";

export interface AccountMappingInput {
  home_base_category: HomeBaseCategory;
  xero_account_code: string;
  xero_account_name: string | null;
  xero_tracking_category_id: string | null;
}

export async function saveXeroAccountMappings(
  tenantId: string,
  mappings: AccountMappingInput[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const rows = mappings
    .filter((m) => m.xero_account_code.trim())
    .map((m) => ({
      user_id: user.id,
      tenant_id: tenantId,
      home_base_category: m.home_base_category,
      xero_account_code: m.xero_account_code.trim(),
      xero_account_name: m.xero_account_name,
      xero_tracking_category_id: m.xero_tracking_category_id || null,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("xero_account_mappings")
    .upsert(rows, { onConflict: "user_id,tenant_id,home_base_category" });

  if (error) throw new Error(`Failed to save mappings: ${error.message}`);

  revalidatePath("/settings/xero");
}
