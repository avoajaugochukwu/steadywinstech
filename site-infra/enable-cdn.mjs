#!/usr/bin/env node
// Phase 2: once Railway's cert is issued, flip Cloudflare records to proxied
// (orange cloud) so the CDN + Cloudflare edge SSL kick in.
//   --force   skip the cert check entirely
//   --watch   poll until every cert is issued, then proceed (no babysitting)
import { loadEnv, requireEnv, loadSite, hostname, bold, ok, warn, info, fail, green, isCertIssued, sleep } from "./lib/util.mjs";
import * as cf from "./lib/cloudflare.mjs";
import * as railway from "./lib/railway.mjs";

loadEnv();
const cfToken = requireEnv("CLOUDFLARE_API_TOKEN");
const rwToken = requireEnv("RAILWAY_API_TOKEN");
const force = process.argv.includes("--force");
const watch = process.argv.includes("--watch");
const site = loadSite(process.argv[2]);

const subs = site.subdomains?.length ? site.subdomains : ["@", "www"];
const hostnames = subs.map((s) => hostname(site.domain, s));

const allIssued = async () => {
  for (const host of hostnames) {
    const dom = await railway.getStatus(rwToken, { ...site.railway, domain: host });
    if (!isCertIssued(dom?.status?.certificateStatus)) return false;
  }
  return true;
};

// Gate on Railway cert status unless forced.
if (!force) {
  if (watch) {
    const MAX = 40; // ~40 min at 60s intervals
    let ready = false;
    for (let i = 1; i <= MAX; i++) {
      if (await allIssued()) { ready = true; break; }
      info(`  …waiting for cert issuance (${i}/${MAX})`);
      await sleep(60000);
    }
    if (!ready) fail("Certs still not issued after ~40 min. Check: node status.mjs " + process.argv[2]);
  } else if (!(await allIssued())) {
    fail(`Cert not issued yet. Wait and re-run, add --watch to poll, or --force to override. Check: node status.mjs ${process.argv[2]}`);
  }
  ok("Railway certificates issued");
}

const zone = await cf.findZone(cfToken, site.domain);
if (!zone) fail("Cloudflare zone not found — run setup-site.mjs first.");

const changed = await cf.setProxied(cfToken, zone.id, hostnames, true);
if (changed.length) ok(`Proxy enabled on: ${changed.join(", ")}`);
else warn("No records changed (already proxied?)");

// Make sure SSL is still strict (idempotent).
await cf.hardenSsl(cfToken, zone.id);

info(bold("\n" + green(`${site.domain} is live behind Cloudflare with Full (strict) SSL. 🎉`)));
info("");
