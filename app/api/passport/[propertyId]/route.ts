import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ propertyId: string }>;
}

// Create or regenerate the passport link for a property
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { propertyId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const { data: property } = await supabase
    .from("properties")
    .select("id, user_id")
    .eq("id", propertyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Upsert: one link per property; regenerate replaces the token via delete + insert
  await supabase
    .from("property_passport_links")
    .delete()
    .eq("property_id", propertyId);

  const { data: link, error } = await supabase
    .from("property_passport_links")
    .insert({
      property_id: propertyId,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ link }, { status: 201 });
}

// Revoke / delete the passport link
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { propertyId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("property_passport_links")
    .delete()
    .eq("property_id", propertyId)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Get current link for a property (owner only)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { propertyId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: link } = await supabase
    .from("property_passport_links")
    .select("*")
    .eq("property_id", propertyId)
    .eq("owner_id", user.id)
    .maybeSingle();

  return NextResponse.json({ link });
}
