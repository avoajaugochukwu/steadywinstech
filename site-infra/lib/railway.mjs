// Railway public GraphQL API client. Endpoint: backboard.railway.com/graphql/v2
// Docs: https://docs.railway.com/integrations/api/manage-domains
const ENDPOINT = "https://backboard.railway.com/graphql/v2";

async function gql(token, query, variables) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.errors?.length) {
    throw new Error("Railway API: " + json.errors.map((e) => e.message).join("; "));
  }
  if (!res.ok) throw new Error(`Railway API HTTP ${res.status}`);
  return json.data;
}

// Lists projects with their services + environments so you can grab the IDs.
// Uses the top-level `projects` query so it works with workspace/team tokens
// (the `me` query is only authorized for personal account tokens).
export async function listProjects(token) {
  const data = await gql(
    token,
    `query {
      projects {
        edges { node {
          id name
          services { edges { node { id name } } }
          environments { edges { node { id name } } }
        } }
      }
    }`
  );
  return (data.projects?.edges || []).map((e) => ({
    id: e.node.id,
    name: e.node.name,
    services: (e.node.services?.edges || []).map((s) => s.node),
    environments: (e.node.environments?.edges || []).map((v) => v.node),
  }));
}

const DNS_RECORDS = `dnsRecords { hostlabel fqdn recordType requiredValue currentValue purpose status zone }`;

// Railway returns recordType as an enum like "DNS_RECORD_TYPE_CNAME"; map it to
// the bare type ("CNAME") that Cloudflare expects.
function normalize(domain) {
  if (domain?.status?.dnsRecords) {
    domain.status.dnsRecords = domain.status.dnsRecords.map((r) => ({
      ...r,
      recordType: (r.recordType || "").replace(/^DNS_RECORD_TYPE_/, ""),
    }));
  }
  return domain;
}

// Existing custom domains for a service (used for idempotency + status).
export async function listCustomDomains(token, { projectId, environmentId, serviceId }) {
  const data = await gql(
    token,
    `query domains($projectId:String!,$environmentId:String!,$serviceId:String!){
      domains(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId){
        customDomains { id domain status { certificateStatus verificationToken ${DNS_RECORDS} } }
      }
    }`,
    { projectId, environmentId, serviceId }
  );
  return (data.domains?.customDomains || []).map(normalize);
}

export async function createCustomDomain(token, { projectId, environmentId, serviceId, domain, targetPort }) {
  const input = { projectId, environmentId, serviceId, domain };
  if (targetPort != null) input.targetPort = targetPort;
  const data = await gql(
    token,
    `mutation customDomainCreate($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id domain
        status { certificateStatus verificationToken ${DNS_RECORDS} }
      }
    }`,
    { input }
  );
  return normalize(data.customDomainCreate);
}

// Create the domain, or return the existing one if Railway already has it.
export async function ensureCustomDomain(token, params) {
  const existing = await listCustomDomains(token, params);
  const match = existing.find((d) => d.domain === params.domain);
  if (match) return { ...match, created: false };
  const created = await createCustomDomain(token, params);
  return { ...created, created: true };
}

export async function getStatus(token, params) {
  const all = await listCustomDomains(token, params);
  return all.find((d) => d.domain === params.domain) || null;
}

export async function deleteCustomDomain(token, id) {
  await gql(token, `mutation($id:String!){ customDomainDelete(id:$id) }`, { id });
}

// Set (upsert) an environment variable on a service. skipDeploys avoids an
// immediate redeploy (the new value applies on the next deploy).
export async function upsertVariable(token, { projectId, environmentId, serviceId, name, value, skipDeploys = true }) {
  await gql(
    token,
    `mutation variableUpsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }`,
    { input: { projectId, environmentId, serviceId, name, value, skipDeploys } }
  );
}
