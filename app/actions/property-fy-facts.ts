"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PropertyFyFactsInput {
  propertyId: string;
  financialYearEnd: number;
  ownershipPct: number;
  daysAvailableForRent: number | null;
  privateUseDays: number | null;
  notes: string | null;
}

/**
 * Record ownership and availability for one property in one financial year.
 *
 * Upserts on (property_id, financial_year_end) so each year is edited
 * independently — correcting last year must never rewrite this year. Access is
 * enforced by RLS: the write policy requires `has_property_write_access`, so a
 * viewer (e.g. a shared accountant) is rejected by the database rather than by
 * a check here.
 */
export async function upsertPropertyFyFacts(
  input: PropertyFyFactsInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (!(input.ownershipPct > 0 && input.ownershipPct <= 100)) {
    return { error: "Ownership must be greater than 0 and at most 100%." };
  }
  for (const [label, value] of [
    ["Days available for rent", input.daysAvailableForRent],
    ["Private use days", input.privateUseDays],
  ] as const) {
    if (value != null && (value < 0 || value > 366)) {
      return { error: `${label} must be between 0 and 366.` };
    }
  }

  const { error } = await supabase.from("property_fy_facts").upsert(
    {
      property_id: input.propertyId,
      financial_year_end: input.financialYearEnd,
      ownership_pct: input.ownershipPct,
      days_available_for_rent: input.daysAvailableForRent,
      private_use_days: input.privateUseDays,
      notes: input.notes,
    },
    { onConflict: "property_id,financial_year_end" },
  );

  if (error) return { error: error.message };

  revalidatePath(`/properties/${input.propertyId}/tax-report`);
  return { error: null };
}
