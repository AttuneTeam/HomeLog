import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractRentalStatementFields } from "@/lib/ai/extract-rental-statement";
import { mimeTypeFromPath } from "@/lib/ai/extract-text";

/**
 * Attach a managing agent's rental statement to a rent payment and extract the
 * gross rent and agency fees it evidences.
 *
 * Follows the staged-review pattern: this route stores the document, records
 * what the model read, and leaves `fees_confirmed_at` NULL. Nothing here is
 * claimable until a human confirms it — see app/actions/rental-statements.ts.
 *
 * Takes an existing paymentId rather than creating a row. Rent payments already
 * arrive from the inbound-email webhook, so the common case is attaching the
 * statement to a payment that is already recorded; creating a second row would
 * double-count the income.
 *
 * The upload uses the RLS-scoped client, so a user can only write into their own
 * storage prefix, and the update is checked against has_property_write_access by
 * the database rather than here.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const paymentId = formData.get("paymentId");

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (typeof paymentId !== "string" || !paymentId) {
    return NextResponse.json({ error: "No payment provided" }, { status: 400 });
  }

  // Resolve the property through the payment, so the storage path is scoped
  // correctly and a caller cannot claim a payment they have no access to — the
  // select is RLS-filtered, so a payment they cannot read simply is not found.
  const { data: payment } = await supabase
    .from("rental_payments")
    .select("id, property_id, statement_path")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json(
      { error: "That rent payment could not be found." },
      { status: 404 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = mimeTypeFromPath(file.name);

  // Store the document first. It is the evidence the tax pack ships, and it
  // stays useful even if extraction fails.
  const ext = file.name.split(".").pop() ?? "pdf";
  const storagePath = `${user.id}/${payment.property_id}/rental-statements/${Date.now()}.${ext}`;
  const { error: storageError } = await supabase.storage
    .from("property-files")
    .upload(storagePath, file);
  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  let extracted: Awaited<
    ReturnType<typeof extractRentalStatementFields>
  > | null = null;
  let extractionError: string | null = null;
  try {
    extracted = await extractRentalStatementFields(buffer, mimeType);
  } catch (error) {
    // A failed extraction must not lose the upload. The statement is still
    // attached so the user can enter the figures by hand against it.
    extractionError =
      error instanceof Error ? error.message : "Extraction failed";
  }

  // `amount` is GROSS rent and is NOT overwritten here. The payment's income
  // figure is already recorded and may have been corrected by hand; silently
  // replacing it with an unconfirmed extraction could change reported income
  // without anyone agreeing to it. The proposal is carried in `extracted` for
  // the confirm step to apply.
  const { data: row, error: updateError } = await supabase
    .from("rental_payments")
    .update({
      statement_path: storagePath,
      management_fees: extracted?.management_fees ?? null,
      letting_fees: extracted?.letting_fees ?? null,
      lease_fees: extracted?.lease_fees ?? null,
      sundry_fees: extracted?.sundry_fees ?? null,
      other_outgoings: extracted?.other_outgoings ?? null,
      other_income: extracted?.other_income ?? null,
      other_income_note: extracted?.other_income_note ?? null,
      net_received: extracted?.net_received ?? null,
      confidence: extracted?.confidence ?? null,
      extracted: extracted
        ? { ...extracted, source_filename: file.name }
        : { error: extractionError, source_filename: file.name },
      // Proposed, not claimable — a human sets this in the confirm action.
      fees_confirmed_at: null,
    })
    .eq("id", paymentId)
    .select()
    .single();

  if (updateError) {
    // No row updated means nothing references the uploaded file, and storage has
    // no cascade — leaving it would orphan the object exactly as
    // docs/account-deletion.md warns. Remove it before returning.
    await supabase.storage.from("property-files").remove([storagePath]);

    // A row-level security rejection means the caller does not have write
    // access to this property. Surfacing the raw Postgres text would leak
    // schema detail and tells the user nothing actionable.
    const denied = updateError.message.includes("row-level security");
    return NextResponse.json(
      {
        error: denied
          ? "You don't have permission to add a statement to this payment."
          : "Couldn't save the statement. Please try again.",
      },
      { status: denied ? 403 : 500 },
    );
  }

  // A statement replacing an earlier one leaves the old object unreferenced.
  // Remove it only after the update succeeded, so a failure cannot destroy the
  // evidence that is still recorded.
  if (payment.statement_path && payment.statement_path !== storagePath) {
    await supabase.storage
      .from("property-files")
      .remove([payment.statement_path]);
  }

  return NextResponse.json({ payment: row, extractionError });
}
