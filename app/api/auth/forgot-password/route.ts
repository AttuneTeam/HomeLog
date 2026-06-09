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
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${origin}/auth/update-password`,
      },
    });

    if (error || !data.properties?.action_link) {
      console.error("[forgot-password] generateLink failed:", error?.message);
    } else {
      await sendPasswordResetEmail({
        to: email,
        resetUrl: data.properties.action_link,
      });
    }
  } catch (err) {
    console.error("[forgot-password] unexpected error:", err);
  }

  // Always report success so callers cannot probe which emails are registered.
  return NextResponse.json({ ok: true });
}
