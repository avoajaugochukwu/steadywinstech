#!/usr/bin/env node
// Shows Railway cert/DNS status + current Cloudflare proxy state for a site.
import { loadEnv, requireEnv, loadSite, hostname, bold, ok, warn, info, dim, step, isCertIssued } from "./lib/util.mjs";
import * as cf from "./lib/cloudflare.mjs";
import * as railway from "./lib/railway.mjs";

loadEnv();
const cfToken = requireEnv("CLOUDFLARE_API_TOKEN");
const rwToken = requireEnv("RAILWAY_API_TOKEN");
const site = loadSite(process.argv[2]);

const subs = site.subdomains?.length ? site.subdomains : ["@", "www"];
const hostnames = subs.map((s) => hostname(site.domain, s));

info(bold(`\nStatus for ${site.domain}\n`));

step("Railway");
let allIssued = true;
for (const host of hostnames) {
  const dom = await railway.getStatus(rwToken, { ...site.railway, domain: host });
  if (!dom) {
    warn(`${host}: not registered in Railway yet`);
    allIssued = false;
    continue;
  }
  const cert = dom.status?.certificateStatus || "UNKNOWN";
  const issued = isCertIssued(cert);
  if (!issued) allIssued = false;
  (issued ? ok : warn)(`${host}: certificate ${bold(cert)}`);
  for (const r of dom.status?.dnsRecords || []) {
    info(dim(`    ${r.recordType} ${r.fqdn || r.hostlabel} → ${r.requiredValue}  [${r.status}]`));
  }
}

step("Cloudflare proxy state");
const zone = await cf.findZone(cfToken, site.domain);
if (!zone) warn("zone not found in Cloudflare");
else {
  const records = await cf.listRecords(cfToken, zone.id);
  for (const name of hostnames) {
    const recs = records.filter((r) => r.name === name && /CNAME|A|AAAA/.test(r.type));
    if (!recs.length) { warn(`${name}: no record`); continue; }
    for (const r of recs) {
      (r.proxied ? ok : info)(`    ${name}: ${r.proxied ? bold("PROXIED (CDN on)") : "dns-only"}`);
    }
  }
}

info("");
if (allIssued) ok(bold(`Certs issued — safe to run: node enable-cdn.mjs ${process.argv[2]}`));
else warn("Waiting on Railway cert issuance before enabling the CDN.");
info("");
