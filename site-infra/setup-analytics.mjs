#!/usr/bin/env node
// Creates a GA4 property + web data stream for a site, then writes the Measurement
// ID (G-XXXX) to the Railway service as an env var. Reads the optional "analytics"
// section of the site config:
//
//   "analytics": {
//     "timeZone": "Etc/UTC",        // optional, default Etc/UTC
//     "currency": "USD",            // optional, default USD
//     "envVar": "NEXT_PUBLIC_GA_ID" // optional, the Railway var to set
//   }
//
// Needs in .env:  GA_ACCOUNT_ID  and  GOOGLE_SA_KEY_FILE  (see README).
import { loadEnv, requireEnv, loadSite, bold, ok, warn, step, info, dim, fail, green } from "./lib/util.mjs";
import * as google from "./lib/google.mjs";
import * as railway from "./lib/railway.mjs";

loadEnv();
const rwToken = process.env.RAILWAY_API_TOKEN;
const site = loadSite(process.argv[2]);

const a = site.analytics || {};
const displayName = a.name || site.domain;
const timeZone = a.timeZone || "Etc/UTC";
const currencyCode = a.currency || "USD";
const envVar = a.envVar || "NEXT_PUBLIC_GA_ID";
const defaultUri = `https://${site.domain}`;

// Manual mode: skip the GA Admin API and just use a Measurement ID you supply,
// via `--id=G-XXXX` or "analytics": { "measurementId": "G-XXXX" } in the config.
// Useful when the service account can't be added to GA yet (propagation delay).
const idArg = (process.argv.find((x) => x.startsWith("--id=")) || "").split("=")[1];
const manualId = idArg || a.measurementId;

info(bold(`\nGA4 setup for ${site.domain}\n`));

let measurementId;
if (manualId) {
  measurementId = manualId;
  ok(`using provided Measurement ID ${bold(measurementId)} (skipping GA Admin API)`);
} else {
  const accountId = requireEnv("GA_ACCOUNT_ID");
  const { token, via } = await google.getAdminToken();
  ok(`authenticated via ${via}`);

  // 1. Property (idempotent by displayName under the account)
  step("Ensuring GA4 property");
  let property = (await google.listProperties(token, accountId)).find((p) => p.displayName === displayName);
  if (property) ok(`property "${displayName}" already existed`);
  else {
    property = await google.createProperty(token, { accountId, displayName, timeZone, currencyCode });
    ok(`created property "${displayName}"`);
  }
  const propId = google.propertyId(property.name);

  // 2. Web data stream (idempotent by defaultUri)
  step("Ensuring web data stream");
  let stream = (await google.listDataStreams(token, propId)).find(
    (s) => s.webStreamData?.defaultUri === defaultUri || s.webStreamData?.defaultUri === defaultUri + "/"
  );
  if (stream) ok("web stream already existed");
  else {
    stream = await google.createWebDataStream(token, propId, { displayName: site.domain, defaultUri });
    ok("created web stream");
  }
  measurementId = stream.webStreamData?.measurementId;
  if (!measurementId) fail("No measurementId returned from the data stream.");
  info(`    ${bold(measurementId)}  (property ${propId})`);
}

// 3. Push the Measurement ID to Railway as an env var
if (site.railway?.serviceId && rwToken) {
  step(`Setting ${envVar} on Railway`);
  await railway.upsertVariable(rwToken, { ...site.railway, name: envVar, value: measurementId });
  ok(`${envVar}=${measurementId} set (skipDeploys — applies on next deploy)`);
} else {
  warn(`Skipped Railway var (no RAILWAY_API_TOKEN or railway.serviceId). Set ${envVar}=${measurementId} yourself.`);
}

info(bold("\n" + green("GA4 configured.")));
info(dim(`Next: render the tag in your app, e.g. with @next/third-parties:`));
info(dim(`  <GoogleAnalytics gaId={process.env.${envVar}} />   then redeploy.`));
info("");
