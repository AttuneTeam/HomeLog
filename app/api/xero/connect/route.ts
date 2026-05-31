import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePKCE, buildAuthUrl, encryptPkceState } from "@/lib/xero/oauth";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/login`);
  }

  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = crypto.randomUUID();

  const encrypted = await encryptPkceState({ codeVerifier, state });
  const authUrl = buildAuthUrl(codeChallenge, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("xero_pkce_state", encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes
    path: "/",
  });

  return response;
}
