import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tenantId: string | undefined = body.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  // Delete connection (RLS ensures own rows only)
  const { error: connError } = await supabase
    .from("xero_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId);

  if (connError) {
    return NextResponse.json({ error: connError.message }, { status: 500 });
  }

  // Delete associated account mappings
  await supabase
    .from("xero_account_mappings")
    .delete()
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId);

  return NextResponse.json({ ok: true });
}
