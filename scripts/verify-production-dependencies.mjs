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
const mobileOnly = [];
for (const advisory of Object.values(report.advisories || {})) {
  if (!new Set(["critical", "high"]).has(advisory.severity)) continue;
  const paths = advisory.findings?.flatMap((finding) => finding.paths || []) || [];
  if (paths.length > 0 && paths.every((path) => path.startsWith("apps__mobile>"))) {
    mobileOnly.push(advisory);
  } else {
    blocking.push(advisory);
  }
}

if (blocking.length) {
  for (const advisory of blocking) {
    console.error(`${advisory.severity}: ${advisory.module_name} (${advisory.github_advisory_id})`);
  }
  process.exit(1);
}

console.log("Deployed web/API dependencies: 0 critical, 0 high advisories");
console.log(
  `Mobile toolchain hold: ${mobileOnly.length} high advisories isolated to the undeployed Expo 51 workspace`,
);
