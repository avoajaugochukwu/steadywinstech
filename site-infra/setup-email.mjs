#!/usr/bin/env node
// Sets up Cloudflare Email Routing for a site: enables routing (adds MX/SPF),
// ensures the forward-to address(es) are registered, and creates the forwarding
// rules. Reads the optional "email" section of the site config:
//
//   "email": {
//     "forward": { "hello": "you@inbox.com", "support": "you@inbox.com" },
//     "catchAll": "you@inbox.com"   // optional: forward everything else
//   }
import { loadEnv, requireEnv, loadSite, bold, ok, warn, step, info, dim, fail, green, yellow } from "./lib/util.mjs";
import * as cf from "./lib/cloudflare.mjs";

loadEnv();
const cfToken = requireEnv("CLOUDFLARE_API_TOKEN");
const site = loadSite(process.argv[2]);

const email = site.email;
if (!email || (!email.forward && !email.catchAll)) {
  warn(`No "email" section in ${process.argv[2]} — nothing to do.`);
  info(dim('Add e.g.  "email": { "forward": { "hello": "you@inbox.com" } }'));
  process.exit(0);
}

info(bold(`\nEmail routing for ${site.domain}\n`));

const accountId = await cf.resolveAccountId(cfToken, process.env.CLOUDFLARE_ACCOUNT_ID);
const zone = await cf.findZone(cfToken, site.domain);
if (!zone) fail(`Cloudflare zone for ${site.domain} not found — run setup-site.mjs first.`);

// 1. Enable Email Routing (adds MX + SPF). Idempotent.
step("Enabling Email Routing (MX + SPF)");
try {
  await cf.enableEmailRouting(cfToken, zone.id);
  ok("Email Routing enabled");
} catch (e) {
  // Already enabled, or records already present — not fatal.
  warn(`enable returned: ${e.message}`);
}

// 2. Ensure all destination (forward-to) addresses exist + note verification.
const forward = email.forward || {};
const destinations = [...new Set([...Object.values(forward), ...(email.catchAll ? [email.catchAll] : [])])];
const unverified = [];
step("Ensuring forward-to addresses");
for (const dest of destinations) {
  const r = await cf.ensureDestination(cfToken, accountId, dest);
  if (r.verified) ok(`${dest} (verified)`);
  else {
    warn(`${dest} — ${r.created ? "verification email sent" : "NOT verified yet"}`);
    unverified.push(dest);
  }
}

// 3. Create forwarding rules.
step("Creating forwarding rules");
for (const [local, dest] of Object.entries(forward)) {
  const source = `${local}@${site.domain}`;
  const r = await cf.ensureEmailRule(cfToken, zone.id, { source, destination: dest });
  info(`    ${source}  →  ${dest}  ${dim(`(${r.created ? "created" : "already existed"})`)}`);
}
if (email.catchAll) {
  // Catch-all is its own special rule type; expose it as a literal "*"-style note.
  const r = await cf.ensureEmailRule(cfToken, zone.id, {
    source: `*@${site.domain}`,
    destination: email.catchAll,
    name: "catch-all",
  }).catch((e) => ({ created: false, err: e.message }));
  info(`    *@${site.domain}  →  ${email.catchAll}  ${dim(r.err ? `(skipped: ${r.err})` : `(${r.created ? "created" : "already existed"})`)}`);
}

info(bold("\n" + green("Email routing configured.")));
if (unverified.length) {
  info(yellow(bold("\n⚑ Action required: verify the forward-to address(es):")));
  for (const d of unverified) info("    " + bold(d) + dim("  — click the link in the email Cloudflare just sent"));
  info(dim("   Forwarding won't deliver until verified. Re-run this script anytime to recheck status."));
}
info("");
