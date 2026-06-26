#!/usr/bin/env node
// Removes the Railway custom domains and their Cloudflare DNS records for a site.
// Does NOT delete the Cloudflare zone (so you keep the nameservers). Pass
// --zone to also delete the zone.
import { loadEnv, requireEnv, loadSite, hostname, bold, ok, warn, info } from "./lib/util.mjs";
import * as cf from "./lib/cloudflare.mjs";
import * as railway from "./lib/railway.mjs";

loadEnv();
const cfToken = requireEnv("CLOUDFLARE_API_TOKEN");
const rwToken = requireEnv("RAILWAY_API_TOKEN");
const site = loadSite(process.argv[2]);
const dropZone = process.argv.includes("--zone");

const subs = site.subdomains?.length ? site.subdomains : ["@", "www"];
const hostnames = subs.map((s) => hostname(site.domain, s));

info(bold(`\nTearing down ${site.domain}\n`));

for (const host of hostnames) {
  const dom = await railway.getStatus(rwToken, { ...site.railway, domain: host });
  if (dom?.id) {
    await railway.deleteCustomDomain(rwToken, dom.id);
    ok(`Railway: removed ${host}`);
  } else warn(`Railway: ${host} not found`);
}

const zone = await cf.findZone(cfToken, site.domain);
if (zone) {
  const records = await cf.listRecords(cfToken, zone.id);
  for (const r of records.filter((r) => hostnames.includes(r.name))) {
    await cf.deleteRecord(cfToken, zone.id, r.id);
    ok(`Cloudflare: removed ${r.type} ${r.name}`);
  }
  if (dropZone) {
    warn("Zone deletion via API not performed automatically — delete it in the dashboard if you really want to.");
  }
} else warn("Cloudflare: zone not found");
info("");
