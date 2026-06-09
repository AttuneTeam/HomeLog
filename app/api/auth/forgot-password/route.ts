import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    // Using the SSR client (not admin) so that the PKCE code verifier is stored
    // in the response cookies. The callback route then reads that cookie when
    // exchanging the code Supabase appends to the redirect URL.
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
    });

    if (error) {
      console.error("[forgot-password] resetPasswordForEmail failed:", error.message);
    }
  } catch (err) {
    console.error("[forgot-password] unexpected error:", err);
  }

  // Always report success so callers cannot probe which emails are registered.
  return NextResponse.json({ ok: true });
}
