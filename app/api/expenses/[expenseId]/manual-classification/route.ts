import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ManualTaxClassification } from "@/lib/supabase/database.types";

const VALID: ManualTaxClassification[] = [
  "Immediate Repair",
  "Repair",
  "Capital Works",
];

interface RouteParams {
  params: Promise<{ expenseId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { expenseId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const classification: ManualTaxClassification = body.classification;

  if (!VALID.includes(classification)) {
    return NextResponse.json({ error: "Invalid classification" }, { status: 400 });
  }

  // RLS ensures user can only update their own expenses
  const { error } = await supabase
    .from("expenses")
    .update({ manual_classification: classification })
    .eq("id", expenseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
