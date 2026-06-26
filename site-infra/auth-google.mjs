#!/usr/bin/env node
// One-time OAuth login for GA4, using YOUR Google account (the one that already has
// access to Google Analytics). Saves a refresh token to google-oauth-token.json so
// setup-analytics.mjs can run unattended afterwards.
//
// Prereq: download a "Desktop app" OAuth client JSON from Google Cloud Console →
// APIs & Services → Credentials, and save it as google-oauth-client.json (see README).
import { createServer } from "node:http";
import { loadEnv, bold, ok, info, dim, fail, green, cyan } from "./lib/util.mjs";
import * as google from "./lib/google.mjs";

loadEnv();
const client = google.loadOAuthClient();

// Loopback server catches Google's redirect with the auth code.
const server = createServer();
await new Promise((res) => server.listen(0, "127.0.0.1", res));
const port = server.address().port;
const redirectUri = `http://localhost:${port}`;
const url = google.consentUrl(client, redirectUri);

info(bold("\nOpen this URL in your browser and approve access:\n"));
info(cyan(url));
info(dim('\n(If you see "Google hasn\'t verified this app", click Advanced → Go to … (unsafe) — that\'s expected for your own testing app.)'));
info(dim("Waiting for you to approve… (Ctrl-C to cancel)\n"));

const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out after 5 min")), 5 * 60 * 1000);
  server.on("request", (req, resp) => {
    const u = new URL(req.url, redirectUri);
    const c = u.searchParams.get("code");
    const err = u.searchParams.get("error");
    resp.writeHead(200, { "Content-Type": "text/html" });
    resp.end(`<html><body style="font-family:sans-serif"><h2>${c ? "✓ Authorized — you can close this tab." : "Authorization failed: " + err}</h2></body></html>`);
    clearTimeout(timer);
    if (c) resolve(c);
    else reject(new Error(err || "no code"));
  });
}).catch((e) => fail(e.message));

server.close();
const tokens = await google.exchangeCode(client, code, redirectUri);
if (!tokens.refresh_token) {
  fail("No refresh token returned. Revoke the app's access at https://myaccount.google.com/permissions and re-run (we request prompt=consent + offline).");
}
const path = google.saveOAuthToken(tokens.refresh_token);
ok(`refresh token saved to ${path}`);
info(bold("\n" + green("Google OAuth ready. Now run:  node setup-analytics.mjs sites/<domain>.json")));
info("");
