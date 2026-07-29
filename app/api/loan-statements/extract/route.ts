import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractLoanStatementFields } from "@/lib/ai/extract-loan-statement";
import { mimeTypeFromPath } from "@/lib/ai/extract-text";
import { extractPdfTextLayer } from "@/lib/ai/pdf-text";

/**
 * Upload an annual loan statement and extract the interest it evidences.
 *
 * Follows the staged-review pattern: this route stores the document, records
 * what the model read, and leaves the row UNCONFIRMED. Nothing here is
 * claimable until a human confirms it — see app/actions/loan-statements.ts.
 *
 * The upload is done with the RLS-scoped client, so a user can only write into
 * their own storage prefix, and the loan_statements insert is checked against
 * has_property_write_access by the database rather than here.
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
  const propertyId = formData.get("propertyId");
  const financialYearEnd = Number(formData.get("financialYearEnd"));

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (typeof propertyId !== "string" || !propertyId) {
    return NextResponse.json({ error: "No property provided" }, { status: 400 });
  }
  if (!Number.isInteger(financialYearEnd)) {
    return NextResponse.json(
      { error: "No financial year provided" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = mimeTypeFromPath(file.name);

  // Store the document first. It is the evidence the tax pack ships, and it
  // stays useful even if extraction fails.
  const ext = file.name.split(".").pop() ?? "pdf";
  const storagePath = `${user.id}/${propertyId}/loan-statements/${Date.now()}.${ext}`;
  const { error: storageError } = await supabase.storage
    .from("property-files")
    .upload(storagePath, file);
  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  // Prefer a PDF's own text layer: lender statements are dense tables, which
  // read far more reliably as text than as an image.
  let rawText: string | null = null;
  if (mimeType === "application/pdf") {
    try {
      rawText = await extractPdfTextLayer(buffer);
    } catch {
      rawText = null; // Fall through to the vision path.
    }
  }

  let extracted: Awaited<ReturnType<typeof extractLoanStatementFields>> | null =
    null;
  let extractionError: string | null = null;
  try {
    extracted = await extractLoanStatementFields(buffer, mimeType, {
      rawText: rawText ?? undefined,
    });
  } catch (error) {
    // A failed extraction must not lose the upload. The row is still created
    // so the user can enter the figure by hand against the stored document.
    extractionError =
      error instanceof Error ? error.message : "Extraction failed";
  }

  const { data: row, error: insertError } = await supabase
    .from("loan_statements")
    .insert({
      property_id: propertyId,
      financial_year_end: financialYearEnd,
      storage_path: storagePath,
      // Proposed, not claimable — confirmed_at stays null until a human agrees.
      interest_paid: extracted?.interest_paid ?? null,
      lender: extracted?.lender ?? null,
      account_ref: extracted?.account_ref ?? null,
      period_start: extracted?.period_start ?? null,
      period_end: extracted?.period_end ?? null,
      confidence: extracted?.confidence ?? null,
      extracted: extracted
        ? { ...extracted, source_filename: file.name }
        : { error: extractionError, source_filename: file.name },
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    statement: row,
    extractionError,
    usedTextLayer: rawText != null,
  });
}
