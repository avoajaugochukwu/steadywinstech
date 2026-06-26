#!/usr/bin/env node
// One-off: create a Railway project + service deployed from a GitHub repo, with
// build-time env vars baked in so the first build succeeds. Idempotent-ish:
// re-running finds the existing project/service by name instead of duplicating.
import { loadEnv, requireEnv } from "./lib/util.mjs";

loadEnv();
const token = requireEnv("RAILWAY_API_TOKEN");

const NAME = process.env.PROJECT_NAME || "randomyl";
const REPO = process.env.REPO || "avoajaugochukwu/randomyl.com";
const BRANCH = process.env.BRANCH || "main";

// Build-time vars the Next.js app needs (read from process env, set by caller).
const VARS = {};
for (const k of ["NOTION_API_KEY", "NOTION_DATABASE_ID", "OPENAI_API_KEY"]) {
  if (process.env[k]) VARS[k] = process.env[k];
}

const ENDPOINT = "https://backboard.railway.com/graphql/v2";
async function gql(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.errors?.length) throw new Error("Railway: " + json.errors.map((e) => e.message).join("; "));
  if (!res.ok) throw new Error("Railway HTTP " + res.status);
  return json.data;
}

// 1. Find or create the project
const existing = await gql(`query { projects { edges { node {
  id name
  environments { edges { node { id name } } }
  services { edges { node { id name } } }
} } } }`);
let project = existing.projects.edges.map((e) => e.node).find((p) => p.name === NAME);

if (!project) {
  console.log(`Creating project "${NAME}"...`);
  const d = await gql(
    `mutation($input: ProjectCreateInput!) { projectCreate(input: $input) {
      id name
      environments { edges { node { id name } } }
      services { edges { node { id name } } }
    } }`,
    { input: { name: NAME, defaultEnvironmentName: "production" } }
  );
  project = d.projectCreate;
  console.log("  project:", project.id);
} else {
  console.log(`Project "${NAME}" already exists:`, project.id);
}

const env =
  project.environments.edges.map((e) => e.node).find((e) => e.name === "production") ||
  project.environments.edges[0]?.node;
if (!env) throw new Error("No environment found on project");

// 2. Find or create the service from the GitHub repo
let service = project.services.edges.map((e) => e.node).find((s) => s.name === NAME);
if (!service) {
  console.log(`Creating service "${NAME}" from ${REPO}@${BRANCH}...`);
  const d = await gql(
    `mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name } }`,
    {
      input: {
        projectId: project.id,
        environmentId: env.id,
        name: NAME,
        branch: BRANCH,
        source: { repo: REPO },
        variables: VARS,
      },
    }
  );
  service = d.serviceCreate;
  console.log("  service:", service.id);
} else {
  console.log(`Service "${NAME}" already exists:`, service.id);
  // Ensure vars are set even on a pre-existing service
  for (const [name, value] of Object.entries(VARS)) {
    await gql(
      `mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`,
      { input: { projectId: project.id, environmentId: env.id, serviceId: service.id, name, value, skipDeploys: true } }
    );
  }
  console.log("  vars upserted:", Object.keys(VARS).join(", ") || "(none)");
}

console.log("\n--- IDs for sites/randomyl.com.json ---");
console.log(JSON.stringify({ projectId: project.id, environmentId: env.id, serviceId: service.id }, null, 2));
