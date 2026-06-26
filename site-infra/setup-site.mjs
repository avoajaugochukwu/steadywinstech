#!/usr/bin/env node
// Phase 1: register the domain end-to-end, DNS-only (no proxy yet) so Railway
// can verify ownership and issue its TLS cert. Run enable-cdn.mjs afterwards.
import { loadEnv, requireEnv, loadSite, hostname, bold, ok, step, info, warn, dim, green } from "./lib/util.mjs";
import * as cf from "./lib/cloudflare.mjs";
import * as railway from "./lib/railway.mjs";

loadEnv();
const cfToken = requireEnv("CLOUDFLARE_API_TOKEN");
const rwToken = requireEnv("RAILWAY_API_TOKEN");
const site = loadSite(process.argv[2]);

const subs = site.subdomains?.length ? site.subdomains : ["@", "www"];
const hostnames = subs.map((s) => hostname(site.domain, s));

info(bold(`\nSetting up ${site.domain}  (${hostnames.join(", ")})\n`));

// 1. Cloudflare zone
step("Cloudflare: ensuring zone");
const accountId = await cf.resolveAccountId(cfToken, process.env.CLOUDFLARE_ACCOUNT_ID);
const zone = await cf.ensureZone(cfToken, accountId, site.domain);
ok(`zone ${zone.id} (${zone.created ? "created" : "already existed"})`);

// 2. SSL hardening
step("Cloudflare: SSL = Full (strict), force HTTPS");
await cf.hardenSsl(cfToken, zone.id);
ok("SSL hardened");

// 3. Railway custom domains -> mirror required DNS records into Cloudflare (DNS-only)
const cfRecordNames = [];
for (const host of hostnames) {
  step(`Railway: ensuring custom domain ${host}`);
  const dom = await railway.ensureCustomDomain(rwToken, { ...site.railway, domain: host });
  ok(`${host} (${dom.created ? "created" : "already existed"})`);

  for (const rec of dom.status?.dnsRecords || []) {
    const name = rec.fqdn || rec.hostlabel || site.domain;
    const proxied = false; // phase 1 is always DNS-only
    const r = await cf.upsertRecord(cfToken, zone.id, {
      type: rec.recordType,
      name,
      content: rec.requiredValue,
      proxied,
    });
    info(`    ${dim(rec.recordType.padEnd(5))} ${name}  →  ${rec.requiredValue}  ${dim(`(${r.action}, dns-only)`)}`);
    if (rec.recordType === "CNAME" || rec.recordType === "A") cfRecordNames.push(name);
  }

  // Railway also requires a TXT ownership-verification record (surfaced via
  // verificationToken, NOT in dnsRecords). Without it the domain stays stuck on
  // VALIDATING_OWNERSHIP and returns 404. Cloudflare allows this TXT alongside a
  // flattened apex CNAME.
  const token = dom.status?.verificationToken;
  if (token) {
    const txtName = `_railway-verify.${host}`; // Railway expects the TXT here, NOT on the bare host
    const r = await cf.upsertRecord(cfToken, zone.id, { type: "TXT", name: txtName, content: token, proxied: false });
    info(`    ${dim("TXT".padEnd(5))} ${txtName}  →  ${token.slice(0, 24)}…  ${dim(`(${r.action}, verify)`)}`);
  }
}

// 4. Next steps
info(bold("\n" + green("Done with phase 1.")));
if (zone.created) {
  info(bold("\n⚑ One-time: point your Hostinger nameservers to Cloudflare:"));
  for (const ns of zone.name_servers || []) info("    " + bold(ns));
  info(dim("   Hostinger → Domains → your domain → DNS / Nameservers → use custom nameservers."));
}
info(bold("\nNext:"));
info("  1. Wait for Railway to verify the domain and issue its certificate.");
info(`     Check anytime:  ${bold(`node status.mjs ${process.argv[2]}`)}`);
info(`  2. Once the cert is issued, turn on the Cloudflare CDN/proxy:`);
info(`     ${bold(`node enable-cdn.mjs ${process.argv[2]}`)}`);
warn("Leaving records DNS-only until then is required — the proxy would block Railway's cert check.\n");
