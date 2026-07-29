"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ConfirmRentalStatementInput {
  id: string;
  propertyId: string;
  /** GROSS rent — the assessable figure, not what the agent disbursed. */
  grossRent: number;
  managementFees: number | null;
  lettingFees: number | null;
  leaseFees: number | null;
  sundryFees: number | null;
  otherOutgoings: number | null;
  otherIncome: number | null;
  otherIncomeNote: string | null;
  netReceived: number | null;
}

function invalidAmount(value: number | null): boolean {
  return value != null && (!Number.isFinite(value) || value < 0);
}

/**
 * Accept a rental statement's figures, making the agency fees claimable.
 *
 * Setting `fees_confirmed_at` is the whole point: until it is set the fees are a
 * model's proposal and `resolveAgentFees` excludes them, falling back to the
 * management-percentage estimate. The values are saved as edited, so a corrected
 * figure supersedes what was extracted while `extracted` retains the original
 * for comparison.
 *
 * This is also the only path that writes `amount`. The upload route deliberately
 * does not, because replacing a recorded income figure with an unconfirmed
 * extraction would change reported income with nobody agreeing to it.
 */
export async function confirmRentalStatement(
  input: ConfirmRentalStatementInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (!Number.isFinite(input.grossRent) || input.grossRent < 0) {
    return { error: "Gross rent must be a positive amount." };
  }
  const amounts = [
    input.managementFees,
    input.lettingFees,
    input.leaseFees,
    input.sundryFees,
    input.otherOutgoings,
    input.otherIncome,
    input.netReceived,
  ];
  if (amounts.some(invalidAmount)) {
    return { error: "Amounts cannot be negative." };
  }

  // Deliberately NOT validated: that the figures reconcile. A balance brought
  // forward legitimately breaks the identity, and refusing the save would force
  // the user to enter something false to get past it. The reconciliation is
  // advisory and shown alongside, per FR5.

  const { error } = await supabase
    .from("rental_payments")
    .update({
      amount: input.grossRent,
      management_fees: input.managementFees,
      letting_fees: input.lettingFees,
      lease_fees: input.leaseFees,
      sundry_fees: input.sundryFees,
      other_outgoings: input.otherOutgoings,
      other_income: input.otherIncome,
      other_income_note: input.otherIncomeNote,
      net_received: input.netReceived,
      fees_confirmed_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { error: error.message };

  revalidatePath(`/properties/${input.propertyId}/rent`);
  revalidatePath(`/properties/${input.propertyId}/tax-pack`);
  return { error: null };
}

/**
 * Detach a statement from a rent payment and delete the stored document.
 *
 * The payment row SURVIVES — it records income that was genuinely received, and
 * removing a document is not a statement that the rent never arrived. Only the
 * statement-derived fields are cleared. Deleting the row here would silently
 * reduce reported income.
 *
 * The storage object is deleted explicitly because storage has no DB cascade;
 * clearing the column alone would orphan the file, the failure mode
 * docs/account-deletion.md exists to prevent.
 */
export async function removeRentalStatement(
  id: string,
  propertyId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Read the path before clearing it, or it becomes unrecoverable.
  const { data: existing } = await supabase
    .from("rental_payments")
    .select("statement_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("rental_payments")
    .update({
      statement_path: null,
      management_fees: null,
      letting_fees: null,
      lease_fees: null,
      sundry_fees: null,
      other_outgoings: null,
      other_income: null,
      other_income_note: null,
      net_received: null,
      extracted: null,
      confidence: null,
      fees_confirmed_at: null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  if (existing?.statement_path) {
    await supabase.storage
      .from("property-files")
      .remove([existing.statement_path]);
  }

  revalidatePath(`/properties/${propertyId}/rent`);
  revalidatePath(`/properties/${propertyId}/tax-pack`);
  return { error: null };
}

/**
 * A signed URL for viewing a stored statement.
 *
 * `property-files` is private, so the document is never served by public URL.
 */
export async function rentalStatementUrl(
  storagePath: string,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "Unauthorized" };

  const { data, error } = await supabase.storage
    .from("property-files")
    .createSignedUrl(storagePath, 60 * 10);
  if (error) return { url: null, error: error.message };
  return { url: data?.signedUrl ?? null, error: null };
}
