// Cloudflare API v4 client. Docs: https://developers.cloudflare.com/api/
import { fail } from "./util.mjs";

const BASE = "https://api.cloudflare.com/client/v4";

async function cf(token, path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const errs = (json.errors || []).map((e) => `${e.code} ${e.message}`).join("; ");
    throw new Error(`Cloudflare ${method} ${path} -> ${res.status} ${errs || ""}`.trim());
  }
  return json.result;
}

export async function resolveAccountId(token, fromEnv) {
  if (fromEnv) return fromEnv;
  // A zone-scoped token can't list /accounts, so fall back to reading the
  // account off an existing zone. Only fully fails on a brand-new account
  // with zero zones — in which case set CLOUDFLARE_ACCOUNT_ID in .env.
  const accounts = await cf(token, "/accounts?per_page=50").catch(() => null);
  if (accounts?.length === 1) return accounts[0].id;
  if (accounts?.length > 1) {
    fail(
      `Token sees multiple Cloudflare accounts. Set CLOUDFLARE_ACCOUNT_ID in .env. Options:\n` +
        accounts.map((a) => `  ${a.id}  ${a.name}`).join("\n")
    );
  }
  const zones = await cf(token, "/zones?per_page=50").catch(() => null);
  const ids = [...new Set((zones || []).map((z) => z.account?.id).filter(Boolean))];
  if (ids.length === 1) return ids[0];
  if (ids.length > 1) {
    fail(`Multiple accounts across your zones. Set CLOUDFLARE_ACCOUNT_ID in .env:\n  ${ids.join("\n  ")}`);
  }
  fail("Couldn't determine the Cloudflare account id. Set CLOUDFLARE_ACCOUNT_ID in .env.");
}

export async function findZone(token, name) {
  const result = await cf(token, `/zones?name=${encodeURIComponent(name)}`);
  return result?.[0] || null;
}

// Find the zone or create it. Returns { id, name, name_servers, created }.
export async function ensureZone(token, accountId, name) {
  const existing = await findZone(token, name);
  if (existing) return { ...existing, created: false };
  const created = await cf(token, "/zones", {
    method: "POST",
    body: { name, account: { id: accountId }, type: "full" },
  });
  return { ...created, created: true };
}

export async function setSetting(token, zoneId, key, value) {
  return cf(token, `/zones/${zoneId}/settings/${key}`, {
    method: "PATCH",
    body: { value },
  });
}

// Full (strict) SSL + force HTTPS + auto rewrites. The whole point of "nice Cloudflare SSL".
export async function hardenSsl(token, zoneId) {
  await setSetting(token, zoneId, "ssl", "strict");
  await setSetting(token, zoneId, "always_use_https", "on");
  await setSetting(token, zoneId, "automatic_https_rewrites", "on");
}

export async function listRecords(token, zoneId) {
  return cf(token, `/zones/${zoneId}/dns_records?per_page=200`);
}

// Create or update a record matched by (type, name). Idempotent.
export async function upsertRecord(token, zoneId, { type, name, content, proxied = false, ttl = 1 }) {
  const existing = await listRecords(token, zoneId);
  const match = existing.find((r) => r.type === type && r.name === name);
  const body = { type, name, content, proxied, ttl };
  if (match) {
    const updated = await cf(token, `/zones/${zoneId}/dns_records/${match.id}`, {
      method: "PUT",
      body,
    });
    return { ...updated, action: "updated" };
  }
  const created = await cf(token, `/zones/${zoneId}/dns_records`, { method: "POST", body });
  return { ...created, action: "created" };
}

// Flip every CNAME/A record for the given hostnames between proxied on/off.
export async function setProxied(token, zoneId, hostnames, proxied) {
  const records = await listRecords(token, zoneId);
  const targets = records.filter(
    (r) => (r.type === "CNAME" || r.type === "A" || r.type === "AAAA") && hostnames.includes(r.name)
  );
  const changed = [];
  for (const r of targets) {
    if (r.proxied === proxied) continue;
    await cf(token, `/zones/${zoneId}/dns_records/${r.id}`, {
      method: "PATCH",
      body: { proxied },
    });
    changed.push(r.name);
  }
  return changed;
}

export async function deleteRecord(token, zoneId, id) {
  return cf(token, `/zones/${zoneId}/dns_records/${id}`, { method: "DELETE" });
}

// ---- Email Routing ----

// Enable Email Routing + add/lock the MX & SPF records. Idempotent: re-running
// when already enabled is fine.
export async function enableEmailRouting(token, zoneId) {
  return cf(token, `/zones/${zoneId}/email/routing/dns`, { method: "POST", body: {} });
}

export async function listDestinations(token, accountId) {
  return cf(token, `/accounts/${accountId}/email/routing/addresses?per_page=100`);
}

// Ensure a forward-to (destination) address exists. Creating it makes Cloudflare
// send a verification email — the owner must click the link before forwarding works.
export async function ensureDestination(token, accountId, email) {
  const existing = await listDestinations(token, accountId);
  const match = (existing || []).find((a) => a.email?.toLowerCase() === email.toLowerCase());
  if (match) return { created: false, verified: !!match.verified, email };
  const created = await cf(token, `/accounts/${accountId}/email/routing/addresses`, {
    method: "POST",
    body: { email },
  });
  return { created: true, verified: !!created.verified, email };
}

export async function listEmailRules(token, zoneId) {
  return cf(token, `/zones/${zoneId}/email/routing/rules?per_page=100`);
}

// Create a forward rule (local@domain -> destination), unless one already exists
// for that source address.
export async function ensureEmailRule(token, zoneId, { source, destination, name }) {
  const existing = await listEmailRules(token, zoneId);
  const match = (existing || []).find((r) =>
    (r.matchers || []).some((m) => m.field === "to" && m.value?.toLowerCase() === source.toLowerCase())
  );
  if (match) return { created: false };
  await cf(token, `/zones/${zoneId}/email/routing/rules`, {
    method: "POST",
    body: {
      enabled: true,
      name: name || `forward ${source}`,
      matchers: [{ type: "literal", field: "to", value: source }],
      actions: [{ type: "forward", value: [destination] }],
    },
  });
  return { created: true };
}
