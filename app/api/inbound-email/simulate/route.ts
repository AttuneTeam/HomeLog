import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { handleInboundEmail, InboundAttachmentData } from "../handler";
import { mimeTypeFromPath } from "@/lib/ai/extract-text";

// Dev-only: simulate an inbound email (with optional attachment) without going through Resend
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const form = await req.formData();
  const sender = form.get("sender") as string | null;
  const subject = form.get("subject") as string | null;
  const bodyText = form.get("bodyText") as string | null;
  const userId = form.get("userId") as string | null;
  const file = form.get("file") as File | null;

  if (!sender || !subject || !userId || (!bodyText && !file)) {
    return NextResponse.json(
      { error: "Missing required fields: sender, subject, userId, and bodyText or file" },
      { status: 400 },
    );
  }

  // Read optional attachment into a buffer so it flows through the same path as a real inbound email
  const attachments: InboundAttachmentData[] = [];
  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    attachments.push({
      filename: file.name,
      contentType: file.type || mimeTypeFromPath(file.name),
      buffer,
    });
  }

  const supabase = createAdminClient();
  const messageId = `simulate-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const result = await handleInboundEmail(supabase, {
    userId,
    sender,
    to: `sync+${userId}@mail.homebase.app`,
    subject,
    messageId,
    rawEmail: `From: ${sender}\r\nSubject: ${subject}\r\n\r\n${bodyText ?? ""}`,
    attachments,
  });

  // Return the log entry so the caller can inspect the parse result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: log } = await (supabase as any)
    .from("email_ingestion_log")
    .select("*")
    .eq("source_email_id", messageId)
    .maybeSingle();

  return NextResponse.json({ ...result, log });
}
