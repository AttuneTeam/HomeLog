import { SupabaseClient } from "@supabase/supabase-js";
import { parseEmailStatement } from "@/lib/email-parser/parse-statement";
import {
  extractRentalStatementFields,
  type RentalStatementFields,
} from "@/lib/ai/extract-rental-statement";
import { extractTextFromBuffer, mimeTypeFromPath } from "@/lib/ai/extract-text";

export interface InboundAttachmentData {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

export interface InboundEmailPayload {
  userId: string;
  propertyId: string;
  sender: string;
  to: string;
  subject: string;
  messageId: string;
  rawEmail: string;
  attachments?: InboundAttachmentData[];
}

// Attachment types we can OCR/read for expense extraction
const PARSEABLE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

function isParseable(att: InboundAttachmentData): boolean {
  if (PARSEABLE_TYPES.includes(att.contentType)) return true;
  // Fall back to extension sniffing when content_type is generic
  return PARSEABLE_TYPES.includes(mimeTypeFromPath(att.filename));
}

/**
 * Choose which attachment is the rental statement.
 *
 * Prefers a PDF: managing agents issue statements as PDFs, so where an email
 * carries several attachments an image is far more likely to be a photo of
 * something else — a receipt, a maintenance snap — than the statement itself.
 * Falls back to the first parseable attachment when there is no PDF, because a
 * scanned statement is still better evidence than none.
 */
export function pickStatementAttachment(
  attachments: ReadonlyArray<InboundAttachmentData>,
): InboundAttachmentData | null {
  if (attachments.length === 0) return null;
  const pdf = attachments.find(
    (att) =>
      att.contentType === "application/pdf" ||
      mimeTypeFromPath(att.filename) === "application/pdf",
  );
  return pdf ?? attachments[0];
}

export async function handleInboundEmail(
  supabase: SupabaseClient,
  payload: InboundEmailPayload,
): Promise<{ status: string; recordId?: string }> {
  const {
    userId,
    propertyId,
    sender,
    subject,
    messageId,
    rawEmail,
    attachments = [],
  } = payload;

  // Dedup: check if we've already processed this message
  const { data: existing } = await supabase
    .from("email_ingestion_log")
    .select("id, status")
    .eq("user_id", userId)
    .eq("source_email_id", messageId)
    .maybeSingle();

  if (existing) {
    return { status: "duplicate" };
  }

  // Extract plain text from raw email (strip headers, take body)
  const bodyStart = rawEmail.indexOf("\r\n\r\n");
  const body = bodyStart !== -1 ? rawEmail.slice(bodyStart + 4) : rawEmail;

  // OCR any parseable attachments (water bills, repair invoices) and append
  // their text so the parser sees the real figures, which usually live in the PDF.
  const parseableAttachments = attachments.filter(isParseable);
  let attachmentText = "";
  for (const att of parseableAttachments) {
    try {
      const mime = PARSEABLE_TYPES.includes(att.contentType)
        ? att.contentType
        : mimeTypeFromPath(att.filename);
      const text = await extractTextFromBuffer(att.buffer, mime);
      attachmentText += `\n\n--- Attachment: ${att.filename} ---\n${text}`;
    } catch {
      // Non-fatal — skip unreadable attachment, continue with the rest
    }
  }

  // Parse with Claude (body + attachment text combined)
  const parsed = await parseEmailStatement(
    sender,
    subject,
    body + attachmentText,
  );

  // Look up the most recent rental period for this property (for associating payments)
  const { data: latestPeriod } = await supabase
    .from("rental_periods")
    .select("id")
    .eq("property_id", propertyId)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rentalPeriodId = latestPeriod?.id ?? null;

  let targetTable: string | null = null;
  let targetRecordId: string | null = null;

  if (parsed.type === "rental_payment") {
    const statement = pickStatementAttachment(parseableAttachments);
    const statementIsPdf =
      statement != null &&
      (statement.contentType === "application/pdf" ||
        mimeTypeFromPath(statement.filename) === "application/pdf");

    // Read the figures off the PDF with the schema-validated extractor rather
    // than trusting the email parser for them.
    //
    // The email parser OCRs the attachment to text and asks for freeform JSON.
    // On a real agent statement that produced a DIFFERENT answer on every run:
    // third-party outgoings came back as 2146 (correct), then 3148, then absent,
    // and the amount disbursed to the owner was repeatedly copied into
    // other_income — which would inflate assessable income. One run reported
    // confidence 1.0 while wrong, so confidence cannot be used to filter it.
    //
    // The same document through extractRentalStatementFields — generateObject
    // with a Zod schema, per-field descriptions, no coercion, native PDF rather
    // than OCR'd text — extracted every field exactly, on both statements
    // tested. The email parser still decides rental-vs-expense and matches the
    // property; it just no longer supplies the money.
    let fields: RentalStatementFields | null = null;
    if (statementIsPdf) {
      try {
        fields = await extractRentalStatementFields(
          statement!.buffer,
          "application/pdf",
        );
      } catch {
        // Non-fatal — fall back to the email parser's figures below.
      }
    }

    // Structured extraction wins where it produced a value; the email parser is
    // the fallback so a body-only statement still works.
    const amount = fields?.gross_rent ?? parsed.amount;
    const paymentDate = fields?.statement_date ?? parsed.paymentDate;

    if (amount && paymentDate) {
      // Keep the statement itself, not just the figures read off it. Without this
      // the fees are recorded but the evidence behind them is thrown away, and the
      // tax pack ships a rent line with nothing supporting it — the gap this whole
      // area exists to close.
      //
      // Same bucket and path shape as the manual upload in
      // app/api/rental-statements/extract/route.ts, so both paths produce
      // interchangeable rows. Deletion is already covered: migration 064
      // enumerates rental_payments.statement_path in both storage-object
      // functions.
      let statementPath: string | null = null;
      if (statement) {
        const ext = statement.filename.split(".").pop()?.toLowerCase() ?? "pdf";
        const path = `${userId}/${propertyId}/rental-statements/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("property-files")
          .upload(path, statement.buffer, {
            contentType: statement.contentType,
          });
        // A failed upload must not lose the payment. The figures are already
        // extracted and are worth recording without the document.
        if (!uploadError) statementPath = path;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("rental_payments")
        .insert({
          property_id: propertyId,
          rental_period_id: rentalPeriodId,
          payment_date: paymentDate,
          // GROSS rent — the assessable figure. The email parser used to put the
          // net disbursed amount here, which actualRentForFy then reported as
          // gross rent, understating income by the agent's fees and outgoings.
          amount,
          period_start: fields?.period_start ?? parsed.periodStart,
          period_end: fields?.period_end ?? parsed.periodEnd,
          source_email_id: messageId,
          raw_subject: subject,
          management_fees: fields?.management_fees ?? parsed.managementFees,
          letting_fees: fields?.letting_fees ?? parsed.lettingFees,
          lease_fees: fields?.lease_fees ?? parsed.leaseFees,
          sundry_fees: fields?.sundry_fees ?? parsed.sundryFees,
          // Reconciliation only — never deducted. The supplier's own invoice is
          // what makes these claimable, and classifies them correctly.
          other_outgoings: fields?.other_outgoings ?? parsed.otherOutgoings,
          // Assessable, but NOT rent — kept out of `amount` so gross rent stays
          // comparable to the tenancy accrual. Without it the reconciliation is
          // off by exactly the reimbursement.
          //
          // Taken ONLY from the structured extraction when one ran: the email
          // parser repeatedly copied the disbursed amount here, which would report
          // it as income on top of the rent.
          other_income: fields ? fields.other_income : parsed.otherIncome,
          other_income_note: fields
            ? fields.other_income_note
            : parsed.otherIncomeNote,
          net_received: fields?.net_received ?? parsed.netReceived,
          statement_path: statementPath,
          extracted: {
            ...parsed,
            source: "inbound_email",
            statement_filename: statement?.filename ?? null,
            // Which extractor supplied the money, and what it read. Kept so a
            // confirmed figure can always be compared against its origin.
            figures_from: fields ? "statement_pdf" : "email_text",
            statement_fields: fields,
          },
          confidence: fields?.confidence ?? parsed.confidence,
          // Deliberately NOT confirmed. An extraction is a proposal, so these
          // fees are not claimable until a human accepts them — the same gate
          // loan_statements.confirmed_at applies to interest.
          fees_confirmed_at: null,
        })
        .select("id")
        .single();

      // No row means nothing references the uploaded object, and storage has no
      // cascade — leaving it would orphan the file exactly as
      // docs/account-deletion.md warns.
      if (insertError && statementPath) {
        await supabase.storage.from("property-files").remove([statementPath]);
      }

      targetTable = "rental_payments";
      targetRecordId = inserted?.id ?? null;
    }
  } else if (parsed.type === "expense" && parsed.amount && parsed.paymentDate) {
    // Persist the primary attachment (the actual bill/invoice) to the invoices
    // bucket so it's linked to the expense, mirroring the manual upload path.
    let invoicePath: string | null = null;
    const primary = parseableAttachments[0];
    if (primary) {
      const ext = primary.filename.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${userId}/rental-expenses/${propertyId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(path, primary.buffer, { contentType: primary.contentType });
      if (!uploadError) invoicePath = path;
    }

    const { data: inserted } = await supabase
      .from("rental_operating_expenses")
      .insert({
        property_id: propertyId,
        category: parsed.category ?? "other",
        amount: parsed.amount,
        gst_amount: parsed.gstAmount,
        expense_date: parsed.paymentDate,
        supplier: parsed.supplier,
        abn: parsed.abn,
        description: subject,
        invoice_path: invoicePath,
      })
      .select("id")
      .single();

    targetTable = "rental_operating_expenses";
    targetRecordId = inserted?.id ?? null;
  }

  await supabase.from("email_ingestion_log").insert({
    user_id: userId,
    source_email_id: messageId,
    sender_address: sender,
    raw_subject: subject,
    status: targetTable ? "parsed" : "unmatched",
    extracted_type: parsed.type,
    target_table: targetTable,
    target_record_id: targetRecordId,
    parse_notes: targetTable
      ? `confidence: ${parsed.confidence}`
      : "parsed but missing required fields (amount or date)",
  });

  return {
    status: targetTable ? "parsed" : "unmatched",
    recordId: targetRecordId ?? undefined,
  };
}
