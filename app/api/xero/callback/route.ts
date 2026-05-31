import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  decryptPkceState,
  exchangeCodeForTokens,
  getXeroTenants,
  upsertXeroConnection,
  encryptPkceState,
} from "@/lib/xero/oauth";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/settings/xero?error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code || !returnedState) {
    return NextResponse.redirect(
      `${origin}/settings/xero?error=missing_params`,
    );
  }

  // Validate user is logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Read and verify PKCE cookie
  const cookieStore = await cookies();
  const pkceRaw = cookieStore.get("xero_pkce_state")?.value;
  if (!pkceRaw) {
    return NextResponse.redirect(
      `${origin}/settings/xero?error=pkce_missing`,
    );
  }

  let pkcePayload: { codeVerifier: string; state: string };
  try {
    pkcePayload = await decryptPkceState(pkceRaw);
  } catch {
    return NextResponse.redirect(
      `${origin}/settings/xero?error=pkce_invalid`,
    );
  }

  if (pkcePayload.state !== returnedState) {
    return NextResponse.redirect(
      `${origin}/settings/xero?error=state_mismatch`,
    );
  }

  // Exchange code for tokens
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, pkcePayload.codeVerifier);
  } catch (e) {
    console.error("[xero/callback] token exchange error", e);
    return NextResponse.redirect(
      `${origin}/settings/xero?error=token_exchange_failed`,
    );
  }

  // Fetch Xero tenants (organisations)
  let tenants;
  try {
    tenants = await getXeroTenants(tokens.access_token);
  } catch (e) {
    console.error("[xero/callback] tenant fetch error", e);
    return NextResponse.redirect(
      `${origin}/settings/xero?error=tenant_fetch_failed`,
    );
  }

  if (tenants.length === 0) {
    return NextResponse.redirect(
      `${origin}/settings/xero?error=no_tenants`,
    );
  }

  const clearCookie = (res: NextResponse) => {
    res.cookies.set("xero_pkce_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  // Single tenant — save directly
  if (tenants.length === 1) {
    try {
      await upsertXeroConnection({
        userId: user.id,
        tenantId: tenants[0].tenantId,
        tenantName: tenants[0].tenantName,
        tokens,
      });
    } catch (e) {
      console.error("[xero/callback] upsert error", e);
      return clearCookie(
        NextResponse.redirect(
          `${origin}/settings/xero?error=save_failed`,
        ),
      );
    }
    return clearCookie(
      NextResponse.redirect(`${origin}/settings/xero?connected=1`),
    );
  }

  // Multiple tenants — store tokens in a short-lived cookie and redirect to picker
  const tenantPayload = await encryptPkceState({
    codeVerifier: JSON.stringify({ tokens, tenants }),
    state: pkcePayload.state,
  });

  const res = NextResponse.redirect(`${origin}/settings/xero/select-tenant`);
  res.cookies.set("xero_tenant_selection", tenantPayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  res.cookies.set("xero_pkce_state", "", { maxAge: 0, path: "/" });
  return res;
}
