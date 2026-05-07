import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateObject } from "ai";
import { classificationModel } from "@/lib/ai/openai-client";
import { mimeTypeFromPath } from "@/lib/ai/extract-text";
import { z } from "zod";

const invoiceFieldsSchema = z.object({
  amount: z.number().nullable().describe("Total amount payable on the invoice"),
  gst_amount: z.number().nullable().describe("GST component of the total, if shown separately"),
  expense_date: z.string().nullable().describe("Invoice or service date in YYYY-MM-DD format"),
  description: z.string().nullable().describe("Brief description of what was purchased or the work performed"),
  supplier: z.string().nullable().describe("Supplier or contractor business name"),
  abn: z.string().nullable().describe("Supplier ABN, digits only with spaces removed"),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = mimeTypeFromPath(file.name);

  const { object } = await generateObject({
    model: classificationModel,
    output: "object",
    schema: invoiceFieldsSchema,
    messages: [
      {
        role: "user",
        content: [
          mimeType === "application/pdf"
            ? { type: "file" as const, data: base64, mediaType: "application/pdf" as const }
            : { type: "image" as const, image: `data:${mimeType};base64,${base64}` },
          {
            type: "text",
            text: "Extract the expense fields from this invoice. Return null for any field not found.",
          },
        ],
      },
    ],
  });

  return NextResponse.json(object);
}
