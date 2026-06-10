import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractInvoiceFields } from "@/lib/ai/extract-invoice-fields";
import { extractPdfTextLayer } from "@/lib/ai/pdf-text";
import { mimeTypeFromPath } from "@/lib/ai/extract-text";

// Process a bounded slice per invocation so a large dump can't fan out into
// unbounded simultaneous vision calls or blow the function timeout. The client
// re-invokes until `remaining` reaches 0.
const BATCH_LIMIT = 20;
const CONCURRENCY = 5;

type StagedRow = {
  id: string;
  storage_path: string;
  content_type: string | null;
};

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pending } = await supabase
    .from("staged_receipts")
    .select("id, storage_path, content_type")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  const rows = (pending ?? []) as StagedRow[];

  let processed = 0;
  let failed = 0;

  async function handle(row: StagedRow) {
    await supabase.from("staged_receipts").update({ status: "extracting" }).eq("id", row.id);

    try {
      const { data: file, error: dlError } = await supabase.storage
        .from("invoices")
        .download(row.storage_path);
      if (dlError || !file) throw new Error(dlError?.message ?? "Download failed");

      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = row.content_type || mimeTypeFromPath(row.storage_path);

      // Cost control: read a PDF's embedded text layer locally and use the
      // text-only model path; reserve vision for images and scanned PDFs.
      const textLayer =
        mimeType === "application/pdf" ? await extractPdfTextLayer(buffer) : null;

      const extracted = await extractInvoiceFields(
        buffer,
        mimeType,
        textLayer ? { rawText: textLayer } : undefined,
      );

      const keyFields = [extracted.amount, extracted.supplier, extracted.expense_date];
      const confidence = keyFields.filter((v) => v != null).length / keyFields.length;

      await supabase
        .from("staged_receipts")
        .update({ status: "needs_review", extracted, confidence, error: null })
        .eq("id", row.id);
      processed++;
    } catch (err) {
      await supabase
        .from("staged_receipts")
        .update({ status: "failed", error: (err as Error).message })
        .eq("id", row.id);
      failed++;
    }
  }

  // Bounded-concurrency pool over the batch.
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      await handle(row);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

  const { count: remaining } = await supabase
    .from("staged_receipts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return NextResponse.json({ processed, failed, remaining: remaining ?? 0 });
}
