import { SupabaseClient } from "@supabase/supabase-js";
import { parseEmailStatement } from "@/lib/email-parser/parse-statement";
import { matchPropertyBySender } from "@/lib/email-parser/match-property";
import { extractTextFromBuffer, mimeTypeFromPath } from "@/lib/ai/extract-text";

export interface InboundAttachmentData {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

export interface InboundEmailPayload {
  userId: string;
  sender: string;
  to: string;
  subject: string;
  messageId: string;
  rawEmail: string;
  attachments?: InboundAttachmentData[];
}

// Attachment types we can OCR/read for expense extraction
const PARSEABLE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

function isParseable(att: InboundAttachmentData): boolean {
  if (PARSEABLE_TYPES.includes(att.contentType)) return true;
  // Fall back to extension sniffing when content_type is generic
  return PARSEABLE_TYPES.includes(mimeTypeFromPath(att.filename));
}

export async function handleInboundEmail(
  supabase: SupabaseClient,
  payload: InboundEmailPayload,
): Promise<{ status: string; recordId?: string }> {
  const { userId, sender, subject, messageId, rawEmail, attachments = [] } = payload;

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
  const parsed = await parseEmailStatement(sender, subject, body + attachmentText);

  // Match to a property
  const match = await matchPropertyBySender(supabase, userId, sender, parsed.propertyAddress);

  if (!match.matched) {
    await supabase.from("email_ingestion_log").insert({
      user_id: userId,
      source_email_id: messageId,
      sender_address: sender,
      raw_subject: subject,
      status: "unmatched",
      extracted_type: parsed.type,
      parse_notes: match.reason,
    });
    return { status: "unmatched" };
  }

  let targetTable: string | null = null;
  let targetRecordId: string | null = null;

  if (parsed.type === "rental_payment" && parsed.amount && parsed.paymentDate) {
    const { data: inserted } = await supabase
      .from("rental_payments")
      .insert({
        property_id: match.propertyId,
        rental_period_id: match.rentalPeriodId,
        payment_date: parsed.paymentDate,
        amount: parsed.amount,
        period_start: parsed.periodStart,
        period_end: parsed.periodEnd,
        source_email_id: messageId,
        raw_subject: subject,
      })
      .select("id")
      .single();

    targetTable = "rental_payments";
    targetRecordId = inserted?.id ?? null;
  } else if (parsed.type === "expense" && parsed.amount && parsed.paymentDate) {
    // Persist the primary attachment (the actual bill/invoice) to the invoices
    // bucket so it's linked to the expense, mirroring the manual upload path.
    let invoicePath: string | null = null;
    const primary = parseableAttachments[0];
    if (primary) {
      const ext = primary.filename.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${userId}/rental-expenses/${match.propertyId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(path, primary.buffer, { contentType: primary.contentType });
      if (!uploadError) invoicePath = path;
    }

    const { data: inserted } = await supabase
      .from("rental_operating_expenses")
      .insert({
        property_id: match.propertyId,
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

  return { status: targetTable ? "parsed" : "unmatched", recordId: targetRecordId ?? undefined };
}
