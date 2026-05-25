import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendAccountInviteEmail } from "@/lib/email";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: members, error } = await supabase
    .from("account_members")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email: string = body.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (email === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("account_members")
    .select("id, status")
    .eq("owner_id", user.id)
    .eq("grantee_email", email)
    .maybeSingle();

  if (existing && existing.status !== "declined" && existing.status !== "revoked") {
    return NextResponse.json({ error: "Invite already exists" }, { status: 409 });
  }

  const { data: member, error } = await supabase
    .from("account_members")
    .upsert(
      {
        owner_id: user.id,
        grantee_email: email,
        role: "co_owner",
        status: "pending",
      },
      { onConflict: "owner_id,grantee_email" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get("origin") ?? "";
  const inviteUrl = `${origin}/invite/${member.invite_token}`;

  const adminSupabase = createAdminClient();
  const { data: ownerProfile } = await adminSupabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const inviterName = ownerProfile?.display_name ?? "Someone";

  sendAccountInviteEmail({ to: email, inviterName, inviteUrl }).catch(() => null);

  return NextResponse.json({ member, inviteUrl }, { status: 201 });
}
