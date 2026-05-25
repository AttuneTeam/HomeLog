import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ propertyId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { propertyId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: shares, error } = await supabase
    .from("property_shares")
    .select("*")
    .eq("property_id", propertyId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shares });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { propertyId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the property belongs to this user
  const { data: property } = await supabase
    .from("properties")
    .select("id, user_id, address")
    .eq("id", propertyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
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
    .from("property_shares")
    .select("id, status")
    .eq("property_id", propertyId)
    .eq("grantee_email", email)
    .maybeSingle();

  if (existing && existing.status !== "declined" && existing.status !== "revoked") {
    return NextResponse.json({ error: "Share already exists" }, { status: 409 });
  }

  const { data: share, error } = await supabase
    .from("property_shares")
    .upsert(
      {
        property_id: propertyId,
        owner_id: user.id,
        grantee_email: email,
        role: "viewer",
        status: "pending",
      },
      { onConflict: "property_id,grantee_email" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = req.headers.get("origin") ?? "";
  const inviteUrl = `${origin}/invite/${share.invite_token}`;

  const adminSupabase = createAdminClient();
  adminSupabase.auth.admin.inviteUserByEmail(email, { redirectTo: inviteUrl }).catch(() => null);

  return NextResponse.json({ share, inviteUrl }, { status: 201 });
}
