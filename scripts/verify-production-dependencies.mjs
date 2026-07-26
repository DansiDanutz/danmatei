import { spawnSync } from "node:child_process";

const audit = spawnSync("pnpm", ["audit", "--prod", "--json"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

if (!audit.stdout.trim()) {
  console.error(audit.stderr || "pnpm audit produced no JSON output");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch (error) {
  console.error(`Unable to parse pnpm audit output: ${error.message}`);
  process.exit(1);
}

const blocking = [];
for (const advisory of Object.values(report.advisories || {})) {
  if (!new Set(["critical", "high"]).has(advisory.severity)) continue;
  blocking.push(advisory);
}

if (blocking.length) {
  for (const advisory of blocking) {
    console.error(`${advisory.severity}: ${advisory.module_name} (${advisory.github_advisory_id})`);
  }
  process.exit(1);
}

console.log("All production workspaces: 0 critical, 0 high advisories");
