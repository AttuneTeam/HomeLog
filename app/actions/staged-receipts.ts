"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { EXPENSE_CATEGORIES } from "@/lib/ai/extract-invoice-fields";

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

function normaliseCategory(value: string | null | undefined): ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as ExpenseCategory)
    : "labour";
}

export async function createStagedReceipt(input: {
  storagePath: string;
  originalFilename: string;
  contentType: string;
  propertyId: string;
  renovationId?: string | null;
  source?: "bulk_upload" | "gmail" | "drive" | "mobile" | "email_forward";
}): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("staged_receipts")
    .insert({
      user_id: user.id,
      property_id: input.propertyId,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      content_type: input.contentType,
      renovation_id: input.renovationId ?? null,
      source: input.source ?? "bulk_upload",
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}

/**
 * Reassign staged receipts to a different property during review. The renovation
 * is cleared because renovations are property-specific. RLS scopes the update to
 * the caller's own rows.
 */
export async function setStagedReceiptsProperty(
  ids: string[],
  propertyId: string,
): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("staged_receipts")
    .update({ property_id: propertyId, renovation_id: null })
    .in("id", ids);

  if (error) throw new Error(error.message);
  revalidatePath("/import/review");
}

export async function dismissStagedReceipt(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("staged_receipts")
    .update({ status: "dismissed" })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/import/review");
}

export interface CommitFields {
  amount: number | null;
  gst_amount: number | null;
  expense_date: string | null;
  description: string | null;
  supplier: string | null;
  abn: string | null;
  category: string | null;
  context_notes: string | null;
  raw_text: string | null;
}

/**
 * Promote a staged receipt to a renovation expense. The staging file already
 * lives in the `invoices` bucket, so its path becomes the expense invoice_path
 * directly (no re-upload). Returns the new expense id; the caller fires the
 * embed/classify/contractor enrichment routes (cookie-authed) afterwards.
 */
export async function commitStagedReceipt(
  stagedId: string,
  fields: CommitFields,
  target: { renovationId: string },
): Promise<{ expenseId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: staged, error: stagedError } = await supabase
    .from("staged_receipts")
    .select("id, storage_path, status")
    .eq("id", stagedId)
    .single();
  if (stagedError || !staged) throw new Error("Staged receipt not found");
  if (staged.status === "committed") throw new Error("Already committed");

  const today = new Date().toISOString().split("T")[0];

  const { data: expense, error: insertError } = await supabase
    .from("expenses")
    .insert({
      renovation_id: target.renovationId,
      amount: fields.amount ?? 0,
      gst_amount: fields.gst_amount,
      expense_date: fields.expense_date ?? today,
      description: fields.description,
      supplier: fields.supplier,
      abn: fields.abn,
      context_notes: fields.context_notes,
      raw_text: fields.raw_text,
      category: normaliseCategory(fields.category),
      invoice_path: staged.storage_path,
    })
    .select("id")
    .single();

  if (insertError || !expense) {
    throw new Error(insertError?.message ?? "Failed to create expense");
  }

  const { error: updateError } = await supabase
    .from("staged_receipts")
    .update({
      status: "committed",
      committed_expense_id: expense.id,
      renovation_id: target.renovationId,
    })
    .eq("id", stagedId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/import/review");
  return { expenseId: expense.id };
}
