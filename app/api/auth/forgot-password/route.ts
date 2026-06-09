import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email: string | undefined = body.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 },
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get("origin") ?? "";

  try {
    // generateLink mints the recovery token but we don't use its action_link
    // (that routes through Supabase's verify endpoint + PKCE). Instead we take
    // the raw hashed_token and build a link to our own /auth/confirm route,
    // which verifies it with verifyOtp — no PKCE code verifier required. This
    // keeps the email entirely in our own mailer.
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    const tokenHash = data.properties?.hashed_token;
    if (error || !tokenHash) {
      console.error("[forgot-password] generateLink failed:", error?.message);
    } else {
      const resetUrl = `${origin}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/auth/update-password`;
      await sendPasswordResetEmail({ to: email, resetUrl });
    }
  } catch (err) {
    console.error("[forgot-password] unexpected error:", err);
  }

  // Always report success so callers cannot probe which emails are registered.
  return NextResponse.json({ ok: true });
}
