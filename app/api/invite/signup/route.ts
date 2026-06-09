import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { token, email, password, displayName, inviteType, propertyId } =
    await req.json();

  if (!token || !email || !password || !displayName || !inviteType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  let userId: string;

  const { data: userData, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

  if (createError) {
    // If the account already exists, find the existing user and accept the invite
    const alreadyExists =
      createError.message.toLowerCase().includes("already") ||
      createError.message.toLowerCase().includes("registered") ||
      createError.status === 422;

    if (!alreadyExists) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    const existing = listData?.users?.find((u) => u.email === email);
    if (!existing) {
      return NextResponse.json({ error: "Account already exists. Please sign in to accept." }, { status: 409 });
    }
    userId = existing.id;
  } else {
    userId = userData.user.id;
  }

  const table = inviteType === "account" ? "account_members" : "property_shares";
  const { error: updateError } = await admin
    .from(table)
    .update({ status: "active", grantee_user_id: userId })
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
