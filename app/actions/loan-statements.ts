"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ConfirmLoanStatementInput {
  id: string;
  propertyId: string;
  interestPaid: number;
  lender: string | null;
  accountRef: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

/**
 * Accept a loan statement's figures, making the interest claimable.
 *
 * Setting `confirmed_at` is the whole point of this action: until it is set the
 * figure is a model's proposal and is excluded from claimed totals. The values
 * are saved as edited, so a corrected figure supersedes what was extracted
 * while `extracted` retains the original for comparison.
 */
export async function confirmLoanStatement(
  input: ConfirmLoanStatementInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (!Number.isFinite(input.interestPaid) || input.interestPaid < 0) {
    return { error: "Interest paid must be a positive amount." };
  }
  if (
    input.periodStart &&
    input.periodEnd &&
    input.periodEnd < input.periodStart
  ) {
    return { error: "The period end cannot be before the period start." };
  }

  const { error } = await supabase
    .from("loan_statements")
    .update({
      interest_paid: input.interestPaid,
      lender: input.lender,
      account_ref: input.accountRef,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { error: error.message };

  revalidatePath(`/properties/${input.propertyId}/tax-pack`);
  return { error: null };
}

/**
 * Remove a loan statement and its stored document.
 *
 * The storage object is deleted explicitly because storage has no DB cascade.
 * Deleting the row alone would orphan the file — the same failure mode
 * docs/account-deletion.md exists to prevent.
 */
export async function deleteLoanStatement(
  id: string,
  propertyId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Read the path before the row goes, or it becomes unrecoverable.
  const { data: existing } = await supabase
    .from("loan_statements")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("loan_statements")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  if (existing?.storage_path) {
    await supabase.storage.from("property-files").remove([existing.storage_path]);
  }

  revalidatePath(`/properties/${propertyId}/tax-pack`);
  return { error: null };
}
