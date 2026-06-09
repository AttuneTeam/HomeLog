import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { token, email, password, displayName, inviteType, propertyId } =
    await req.json();

  if (!token || !email || !password || !displayName || !inviteType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: userData, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const table = inviteType === "account" ? "account_members" : "property_shares";
  const { error: updateError } = await admin
    .from(table)
    .update({ status: "active", grantee_user_id: userData.user.id })
    .eq("invite_token", token);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const redirectTo =
    inviteType === "property" && propertyId
      ? `/properties/${propertyId}?invite=accepted`
      : `/?invite=accepted`;

  return NextResponse.json({ ok: true, redirectTo });
}
