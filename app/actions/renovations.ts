"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const RENOVATION_STATUSES = ["planned", "in_progress", "completed"] as const;
type RenovationStatus = (typeof RENOVATION_STATUSES)[number];

function normaliseStatus(value: string | null | undefined): RenovationStatus {
  return (RENOVATION_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as RenovationStatus)
    : "completed";
}

/**
 * Create a bare renovation from a typed name during bulk-receipt review.
 * Mirrors the minimal insert used by the renovation form (classification
 * defaults to "repair"). Status defaults to "completed" — bulk imports are
 * typically historical receipts for finished work. RLS enforces that the
 * property belongs to the caller.
 */
export async function createRenovation(
  name: string,
  propertyId: string,
  status?: string,
): Promise<{ id: string; name: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Renovation name is required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("renovations")
    .insert({
      property_id: propertyId,
      name: trimmed,
      classification: "repair",
      status: normaliseStatus(status),
    })
    .select("id, name")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create renovation");

  revalidatePath("/import/review");
  return { id: data.id, name: data.name };
}
