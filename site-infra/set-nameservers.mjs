#!/usr/bin/env node
// Point a domain's Hostinger nameservers at its Cloudflare zone. Reads the zone's
// assigned NS from Cloudflare, then PUTs them to Hostinger. Handles registrar lock.
import { loadEnv, requireEnv, loadSite, ok, step, info, warn, bold } from "./lib/util.mjs";
import * as cf from "./lib/cloudflare.mjs";
import * as hg from "./lib/hostinger.mjs";

loadEnv();
const cfToken = requireEnv("CLOUDFLARE_API_TOKEN");
const hgToken = requireEnv("HOSTINGER_API_TOKEN");
const site = loadSite(process.argv[2]);

step(`Cloudflare: reading nameservers for ${site.domain}`);
const zone = await cf.findZone(cfToken, site.domain);
if (!zone) throw new Error(`No Cloudflare zone for ${site.domain} — run setup-site first.`);
const ns = zone.name_servers || [];
if (ns.length < 2) throw new Error(`Cloudflare zone has no nameservers yet: ${JSON.stringify(ns)}`);
ok(`Cloudflare NS: ${ns.join(", ")}`);

step(`Hostinger: current nameservers for ${site.domain}`);
const before = await hg.getDomain(hgToken, site.domain);
info(`    current: ${JSON.stringify(before.name_servers)}  (locked: ${before.is_locked})`);

async function setNs() {
  return hg.updateNameservers(hgToken, site.domain, ns);
}

step(`Hostinger: setting nameservers -> Cloudflare`);
try {
  await setNs();
} catch (e) {
  if (/lock/i.test(e.message) || before.is_locked) {
    warn("registrar lock may be blocking; disabling lock and retrying");
    await hg.disableDomainLock(hgToken, site.domain).catch((x) => warn("unlock: " + x.message));
    await setNs();
    await hg.enableDomainLock(hgToken, site.domain).catch(() => {});
    info("    re-enabled registrar lock");
  } else {
    throw e;
  }
}
ok("nameservers updated");

const after = await hg.getDomain(hgToken, site.domain);
info(bold(`    now: ${JSON.stringify(after.name_servers)}`));
info("\nDNS propagation to Cloudflare can take anywhere from minutes to a few hours.");
