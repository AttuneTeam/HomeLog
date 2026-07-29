"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface DepreciationReportInput {
  propertyId: string;
  financialYearEnd: number;
  div43Annual: number | null;
  div40Annual: number | null;
  qsFirm: string | null;
  reportDate: string | null;
  /** Which column of the QS schedule div40Annual was read from. */
  depreciationMethod: "diminishing_value" | "prime_cost" | null;
  storagePath?: string | null;
}

/**
 * Record the depreciation figures a quantity surveyor determined for one year.
 *
 * The product stores what the surveyor determined rather than deriving it —
 * effective lives, prime cost versus diminishing value, and the second-hand
 * plant restriction are their call, not the product's. See migration 056.
 *
 * Upserts on (property_id, financial_year_end) so each year is edited
 * independently. A null storagePath leaves any previously uploaded report in
 * place rather than clearing it.
 */
export async function upsertDepreciationReport(
  input: DepreciationReportInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  for (const [label, value] of [
    ["Capital works (Division 43)", input.div43Annual],
    ["Decline in value (Division 40)", input.div40Annual],
  ] as const) {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      return { error: `${label} must be a positive amount.` };
    }
  }

  const existing = input.storagePath
    ? null
    : await supabase
        .from("depreciation_reports")
        .select("storage_path")
        .eq("property_id", input.propertyId)
        .eq("financial_year_end", input.financialYearEnd)
        .maybeSingle();

  const { error } = await supabase.from("depreciation_reports").upsert(
    {
      property_id: input.propertyId,
      financial_year_end: input.financialYearEnd,
      div43_annual: input.div43Annual,
      div40_annual: input.div40Annual,
      qs_firm: input.qsFirm,
      report_date: input.reportDate,
      depreciation_method: input.depreciationMethod,
      storage_path: input.storagePath ?? existing?.data?.storage_path ?? null,
    },
    { onConflict: "property_id,financial_year_end" },
  );

  if (error) return { error: error.message };

  revalidatePath(`/properties/${input.propertyId}/tax-pack`);
  return { error: null };
}
