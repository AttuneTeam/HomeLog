import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  if (!user) {
    const redirectUrl = `${origin}/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;
    return NextResponse.redirect(redirectUrl);
  }

  // Try account_members first
  const { data: accountMember } = await supabase
    .from("account_members")
    .select("id, grantee_email, status")
    .eq("invite_token", token)
    .maybeSingle();

  if (accountMember) {
    if (accountMember.status === "active") {
      return NextResponse.redirect(`${origin}/?invite=already-accepted`);
    }
    if (accountMember.status === "revoked") {
      return NextResponse.redirect(`${origin}/?invite=revoked`);
    }

    const { error } = await supabase
      .from("account_members")
      .update({ status: "active", grantee_user_id: user.id })
      .eq("id", accountMember.id);

    if (error) {
      return NextResponse.redirect(`${origin}/?invite=error`);
    }

    return NextResponse.redirect(`${origin}/?invite=accepted`);
  }

  // Try property_shares
  const { data: propertyShare } = await supabase
    .from("property_shares")
    .select("id, grantee_email, status, property_id")
    .eq("invite_token", token)
    .maybeSingle();

  if (propertyShare) {
    if (propertyShare.status === "active") {
      return NextResponse.redirect(`${origin}/?invite=already-accepted`);
    }
    if (propertyShare.status === "revoked") {
      return NextResponse.redirect(`${origin}/?invite=revoked`);
    }

    const { error } = await supabase
      .from("property_shares")
      .update({ status: "active", grantee_user_id: user.id })
      .eq("id", propertyShare.id);

    if (error) {
      return NextResponse.redirect(`${origin}/?invite=error`);
    }

    return NextResponse.redirect(
      `${origin}/properties/${propertyShare.property_id}?invite=accepted`
    );
  }

  return NextResponse.redirect(`${origin}/?invite=not-found`);
}
