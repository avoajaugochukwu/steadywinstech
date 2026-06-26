#!/usr/bin/env node
// Prints your Railway projects with their service + environment IDs, so you can
// fill in sites/<domain>.json without digging through the dashboard.
import { loadEnv, requireEnv, bold, dim, info } from "./lib/util.mjs";
import * as railway from "./lib/railway.mjs";

loadEnv();
const token = requireEnv("RAILWAY_API_TOKEN");
const projects = await railway.listProjects(token);

if (!projects.length) {
  info("No projects found for this token.");
  process.exit(0);
}

for (const p of projects) {
  info("\n" + bold(p.name) + dim(`  projectId: ${p.id}`));
  info("  environments:");
  for (const e of p.environments) info(`    ${e.name.padEnd(16)} ${dim(e.id)}`);
  info("  services:");
  for (const s of p.services) info(`    ${s.name.padEnd(16)} ${dim(s.id)}`);
}
info("");
