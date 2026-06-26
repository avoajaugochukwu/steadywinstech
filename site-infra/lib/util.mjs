// Shared helpers: env loading, config loading, logging. No dependencies.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Tiny .env parser so we don't need the dotenv package.
export function loadEnv() {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    fail(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return v;
}

export function loadSite(argPath) {
  if (!argPath) {
    fail("Usage: node <script>.mjs sites/<your-domain>.json");
  }
  const path = resolve(ROOT, argPath);
  if (!existsSync(path)) fail(`Site config not found: ${path}`);
  const cfg = JSON.parse(readFileSync(path, "utf8"));
  if (!cfg.domain) fail(`Site config ${argPath} is missing "domain"`);
  if (!cfg.railway?.projectId || !cfg.railway?.environmentId || !cfg.railway?.serviceId) {
    fail(`Site config ${argPath} needs railway.projectId, railway.environmentId, railway.serviceId. Run: node list-railway.mjs`);
  }
  return cfg;
}

// Turn a config subdomain entry into a full hostname.
// "@" or "" -> apex (the domain itself); "www" -> "www.example.com".
export function hostname(domain, sub) {
  if (!sub || sub === "@") return domain;
  if (sub.endsWith(`.${domain}`) || sub === domain) return sub;
  return `${sub}.${domain}`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Railway's success status is CERTIFICATE_STATUS_TYPE_VALID (or ISSUED). Match
// VALID only at the END so it doesn't catch CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP.
export const isCertIssued = (cert) => /ISSUED|VALID$|READY$|ACTIVE$/i.test(cert || "");

// Console helpers.
const c = (n) => (s) => `\x1b[${n}m${s}\x1b[0m`;
export const bold = c(1), green = c(32), yellow = c(33), red = c(31), cyan = c(36), dim = c(2);
export const info = (...a) => console.log(...a);
export const ok = (...a) => console.log(green("✓"), ...a);
export const warn = (...a) => console.log(yellow("!"), ...a);
export const step = (...a) => console.log(cyan("▸"), ...a);
export function fail(msg) {
  console.error(red("✗ " + msg));
  process.exit(1);
}
