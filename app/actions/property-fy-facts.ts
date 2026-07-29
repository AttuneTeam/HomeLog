"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { daysAvailableInFy } from "@/lib/tax/fy";

export interface PropertyFyFactsInput {
  propertyId: string;
  financialYearEnd: number;
  ownershipPct: number;
  /** Used to derive the day count when supplied. */
  availableFrom: string | null;
  availableTo: string | null;
  /** Only consulted when no availability dates are given. */
  daysAvailableForRent: number | null;
  privateUseDays: number | null;
  notes: string | null;
  /** Financial year start from the user's profile; defaults to 1 July. */
  fyStartMonth?: number;
  fyStartDay?: number;
}

/**
 * Record ownership and availability for one property in one financial year.
 *
 * Upserts on (property_id, financial_year_end) so each year is edited
 * independently — correcting last year must never rewrite this year. Access is
 * enforced by RLS: the write policy requires `has_property_write_access`, so a
 * viewer (e.g. a shared accountant) is rejected by the database rather than by
 * a check here.
 *
 * The day count is derived from the availability dates when they are given, so
 * the stored number always agrees with the dates it came from. A directly
 * entered count is only used when no dates are supplied — the case of a
 * property with several separate availability windows in one year.
 */
export async function upsertPropertyFyFacts(
  input: PropertyFyFactsInput,
): Promise<{ error: string | null; daysAvailable: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", daysAvailable: null };

  if (!(input.ownershipPct > 0 && input.ownershipPct <= 100)) {
    return {
      error: "Ownership must be greater than 0 and at most 100%.",
      daysAvailable: null,
    };
  }

  if (
    input.availableFrom &&
    input.availableTo &&
    input.availableTo < input.availableFrom
  ) {
    return {
      error: "The availability end date cannot be before the start date.",
      daysAvailable: null,
    };
  }

  const hasDates = Boolean(input.availableFrom || input.availableTo);
  const resolvedDays = hasDates
    ? daysAvailableInFy(
        input.financialYearEnd,
        input.availableFrom,
        input.availableTo,
        input.fyStartMonth,
        input.fyStartDay,
      )
    : input.daysAvailableForRent;

  for (const [label, value] of [
    ["Days available for rent", resolvedDays],
    ["Private use days", input.privateUseDays],
  ] as const) {
    if (value != null && (value < 0 || value > 366)) {
      return {
        error: `${label} must be between 0 and 366.`,
        daysAvailable: null,
      };
    }
  }

  const { error } = await supabase.from("property_fy_facts").upsert(
    {
      property_id: input.propertyId,
      financial_year_end: input.financialYearEnd,
      ownership_pct: input.ownershipPct,
      available_from: input.availableFrom,
      available_to: input.availableTo,
      days_available_for_rent: resolvedDays,
      private_use_days: input.privateUseDays,
      notes: input.notes,
    },
    { onConflict: "property_id,financial_year_end" },
  );

  if (error) return { error: error.message, daysAvailable: null };

  revalidatePath(`/properties/${input.propertyId}/tax-report`);
  return { error: null, daysAvailable: resolvedDays };
}
