import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { handleInboundEmail, InboundAttachmentData } from "./handler";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  // Verify Svix signature
  const rawBody = await req.text();
  try {
    resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: { type: string; data: ResendEmailReceivedData };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true }); // Ignore other event types
  }

  const { email_id, from, to, subject, message_id } = event.data;

  // Extract userId from the +tag in the To address (e.g. sync+abc123@mail.homebase.app)
  const toAddress = Array.isArray(to) ? to[0] : to;
  const tagMatch = toAddress?.match(/sync\+([^@]+)@/);
  if (!tagMatch) {
    return NextResponse.json({ ok: true }); // Not addressed to sync+*, ignore
  }
  const userId = tagMatch[1];

  // Fetch full received email (body + attachment metadata) via Resend API
  let bodyText = "";
  let attachmentMeta: { id: string; filename: string | null; content_type: string }[] = [];
  try {
    const emailDetail = await resend.emails.receiving.get(email_id);
    const data = emailDetail.data;
    bodyText = data?.text ?? data?.html ?? "";
    attachmentMeta = data?.attachments ?? [];
  } catch {
    // Non-fatal — proceed with subject-only parsing
  }

  // Download bytes for each attachment (signed URL per attachment)
  const attachments: InboundAttachmentData[] = [];
  for (const meta of attachmentMeta) {
    try {
      const att = await resend.emails.receiving.attachments.get({
        emailId: email_id,
        id: meta.id,
      });
      const downloadUrl = att.data?.download_url;
      if (!downloadUrl) continue;
      const res = await fetch(downloadUrl);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      attachments.push({
        filename: meta.filename ?? `${meta.id}`,
        contentType: meta.content_type,
        buffer,
      });
    } catch {
      // Non-fatal — skip this attachment
    }
  }

  const supabase = createAdminClient();

  try {
    const result = await handleInboundEmail(supabase, {
      userId,
      sender: from,
      to: toAddress,
      subject: subject ?? "",
      messageId: message_id ?? email_id,
      rawEmail: bodyText,
      attachments,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("inbound-email handler error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface ResendEmailReceivedData {
  email_id: string;
  from: string;
  to: string | string[];
  subject: string | null;
  message_id: string | null;
}
