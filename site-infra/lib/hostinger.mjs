// Hostinger API client. Base: https://developers.hostinger.com/api
// Docs: https://developers.hostinger.com/  (domains v1)
const BASE = "https://developers.hostinger.com/api";

async function hg(token, path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Hostinger ${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

export async function listDomains(token) {
  return hg(token, "/domains/v1/portfolio");
}

export async function getDomain(token, domain) {
  return hg(token, `/domains/v1/portfolio/${encodeURIComponent(domain)}`);
}

// Set custom nameservers. Hostinger expects ns1..ns4 keys.
export async function updateNameservers(token, domain, nameservers) {
  const body = {};
  nameservers.slice(0, 4).forEach((ns, i) => {
    body[`ns${i + 1}`] = ns;
  });
  return hg(token, `/domains/v1/portfolio/${encodeURIComponent(domain)}/nameservers`, {
    method: "PUT",
    body,
  });
}

export async function disableDomainLock(token, domain) {
  return hg(token, `/domains/v1/portfolio/${encodeURIComponent(domain)}/domain-lock`, { method: "DELETE" });
}

export async function enableDomainLock(token, domain) {
  return hg(token, `/domains/v1/portfolio/${encodeURIComponent(domain)}/domain-lock`, { method: "PUT" });
}
