// Google Analytics Admin API (v1beta) client.
// Two auth modes, both zero-dependency:
//   - OAuth (your own Google account — preferred; no GA grant needed)
//   - Service account (JWT signed with Node's built-in crypto)
// Docs: https://developers.google.com/analytics/devguides/config/admin/v1
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createSign } from "node:crypto";
import { ROOT, fail } from "./util.mjs";

const ADMIN = "https://analyticsadmin.googleapis.com/v1beta";
export const SCOPE = "https://www.googleapis.com/auth/analytics.edit";
export const OAUTH_CLIENT_FILE = () => process.env.GOOGLE_OAUTH_CLIENT_FILE || "google-oauth-client.json";
export const OAUTH_TOKEN_FILE = "google-oauth-token.json";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

export function loadServiceAccount(keyFile) {
  const path = resolve(ROOT, keyFile);
  if (!existsSync(path)) fail(`Service-account key file not found: ${path} (set GOOGLE_SA_KEY_FILE in .env)`);
  const sa = JSON.parse(readFileSync(path, "utf8"));
  if (!sa.client_email || !sa.private_key) fail(`${keyFile} is not a valid service-account key (missing client_email/private_key).`);
  return sa;
}

// Mint a short-lived OAuth2 access token from the service-account key.
export async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: sa.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const signingInput = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url(claims)}`;
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(sa.private_key).toString("base64url");
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) fail(`Google token exchange failed: ${json.error || res.status} ${json.error_description || ""}`);
  return json.access_token;
}

// ---- OAuth (user account) ----

// Read the OAuth client (downloaded "Desktop app" JSON, with installed/web key).
export function loadOAuthClient() {
  const path = resolve(ROOT, OAUTH_CLIENT_FILE());
  if (!existsSync(path)) fail(`OAuth client file not found: ${path}\n   Download a "Desktop app" OAuth client JSON and save it there (see README).`);
  const j = JSON.parse(readFileSync(path, "utf8"));
  const c = j.installed || j.web || j;
  if (!c.client_id || !c.client_secret) fail(`${OAUTH_CLIENT_FILE()} is not a valid OAuth client (missing client_id/client_secret).`);
  return { client_id: c.client_id, client_secret: c.client_secret };
}

export function consentUrl(client, redirectUri) {
  const p = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(client, code, redirectUri) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) fail(`OAuth code exchange failed: ${j.error || res.status} ${j.error_description || ""}`);
  return j; // { access_token, refresh_token, ... }
}

export function saveOAuthToken(refreshToken) {
  const path = resolve(ROOT, OAUTH_TOKEN_FILE);
  writeFileSync(path, JSON.stringify({ refresh_token: refreshToken }, null, 2));
  return path;
}

async function refreshOAuthAccessToken() {
  const tokenPath = resolve(ROOT, OAUTH_TOKEN_FILE);
  const { refresh_token } = JSON.parse(readFileSync(tokenPath, "utf8"));
  const client = loadOAuthClient();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) fail(`OAuth refresh failed: ${j.error || res.status} ${j.error_description || ""}. Re-run: node auth-google.mjs`);
  return j.access_token;
}

// Pick whichever credential is present: OAuth token file first, else service account.
export async function getAdminToken() {
  if (existsSync(resolve(ROOT, OAUTH_TOKEN_FILE))) {
    return { token: await refreshOAuthAccessToken(), via: "OAuth (your Google account)" };
  }
  const keyFile = process.env.GOOGLE_SA_KEY_FILE || "google-sa.json";
  if (existsSync(resolve(ROOT, keyFile))) {
    const sa = loadServiceAccount(keyFile);
    return { token: await getAccessToken(sa), via: `service account ${sa.client_email}` };
  }
  fail("No Google credentials found. Run `node auth-google.mjs` (OAuth), or set GOOGLE_SA_KEY_FILE.");
}

async function ga(token, path, { method = "GET", body } = {}) {
  const res = await fetch(ADMIN + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GA Admin ${method} ${path} -> ${res.status} ${json.error?.message || ""}`.trim());
  return json;
}

// Accounts the service account has been granted access to.
export async function listAccounts(token) {
  const json = await ga(token, `/accounts?pageSize=200`);
  return json.accounts || [];
}

export async function listProperties(token, accountId) {
  const json = await ga(token, `/properties?filter=${encodeURIComponent(`parent:accounts/${accountId}`)}&pageSize=200`);
  return json.properties || [];
}

export async function createProperty(token, { accountId, displayName, timeZone, currencyCode }) {
  return ga(token, `/properties`, {
    method: "POST",
    body: { parent: `accounts/${accountId}`, displayName, timeZone, currencyCode },
  });
}

export async function listDataStreams(token, propertyId) {
  const json = await ga(token, `/properties/${propertyId}/dataStreams?pageSize=200`);
  return json.dataStreams || [];
}

export async function createWebDataStream(token, propertyId, { displayName, defaultUri }) {
  return ga(token, `/properties/${propertyId}/dataStreams`, {
    method: "POST",
    body: { type: "WEB_DATA_STREAM", displayName, webStreamData: { defaultUri } },
  });
}

// propertyId from a resource name like "properties/123456789"
export const propertyId = (name) => (name || "").split("/").pop();
