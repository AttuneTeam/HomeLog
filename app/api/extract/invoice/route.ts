import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractInvoiceFields } from "@/lib/ai/extract-invoice-fields";
import { mimeTypeFromPath } from "@/lib/ai/extract-text";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = mimeTypeFromPath(file.name);

  const object = await extractInvoiceFields(buffer, mimeType);

  return NextResponse.json(object);
}
