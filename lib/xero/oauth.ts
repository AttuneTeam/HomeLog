import { createAdminClient } from "@/lib/supabase/server";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

const SCOPES =
  "openid profile email accounting.manualjournals accounting.settings offline_access";

export interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface XeroTenant {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantType: string;
}

// PKCE helpers
export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64urlEncode(array);

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const codeChallenge = base64urlEncode(new Uint8Array(digest));

  return { codeVerifier, codeChallenge };
}

function base64urlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function buildAuthUrl(codeChallenge: string, state: string): string {
  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("XERO_CLIENT_ID or XERO_REDIRECT_URI not set");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${XERO_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<XeroTokenResponse> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = process.env.XERO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Xero env vars not set");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<XeroTokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<XeroTokenResponse> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Xero env vars not set");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<XeroTokenResponse>;
}

export async function getXeroTenants(
  accessToken: string,
): Promise<XeroTenant[]> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Xero tenants: ${res.status} ${text}`);
  }

  return res.json() as Promise<XeroTenant[]>;
}

// Encrypts/decrypts a short string using AES-256-GCM with XERO_PKCE_COOKIE_SECRET
async function getCryptoKey(): Promise<CryptoKey> {
  const secret = process.env.XERO_PKCE_COOKIE_SECRET;
  if (!secret) throw new Error("XERO_PKCE_COOKIE_SECRET not set");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    Buffer.from(secret.padEnd(32, "0").slice(0, 32)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
  return keyMaterial;
}

export async function encryptPkceState(payload: {
  codeVerifier: string;
  state: string;
}): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return Buffer.from(combined).toString("base64url");
}

export async function decryptPkceState(
  token: string,
): Promise<{ codeVerifier: string; state: string }> {
  const key = await getCryptoKey();
  const combined = Buffer.from(token, "base64url");
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// Stores fresh tokens and connection info in the DB using the admin client.
// Called both from the OAuth callback and from withTokenRefresh.
export async function upsertXeroConnection(params: {
  userId: string;
  tenantId: string;
  tenantName: string;
  tokens: XeroTokenResponse;
}) {
  const admin = createAdminClient();
  const expiresAt = new Date(
    Date.now() + params.tokens.expires_in * 1000,
  ).toISOString();

  const { error } = await admin.from("xero_connections").upsert(
    {
      user_id: params.userId,
      tenant_id: params.tenantId,
      tenant_name: params.tenantName,
      access_token: params.tokens.access_token,
      refresh_token: params.tokens.refresh_token,
      token_expires_at: expiresAt,
      scopes: params.tokens.scope.split(" "),
    },
    { onConflict: "user_id,tenant_id" },
  );

  if (error) throw new Error(`Failed to save Xero connection: ${error.message}`);
}

// Calls fn(accessToken) and handles a single token refresh if the token is expired.
export async function withTokenRefresh<T>(
  userId: string,
  tenantId: string,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  const admin = createAdminClient();

  const { data: conn, error } = await admin
    .from("xero_connections")
    .select("access_token, refresh_token, token_expires_at, tenant_name")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !conn) {
    throw new Error("No Xero connection found. Please reconnect.");
  }

  let accessToken = conn.access_token;

  // Refresh if expiry is within 2 minutes
  if (new Date(conn.token_expires_at) < new Date(Date.now() + 2 * 60 * 1000)) {
    const tokens = await refreshAccessToken(conn.refresh_token);
    await upsertXeroConnection({
      userId,
      tenantId,
      tenantName: conn.tenant_name ?? "",
      tokens,
    });
    accessToken = tokens.access_token;
  }

  return fn(accessToken);
}
