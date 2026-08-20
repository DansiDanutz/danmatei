import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const auditAll = process.argv.includes("--all");
const auditArgs = ["audit", ...(auditAll ? [] : ["--prod"]), "--json"];
const audit = spawnSync("pnpm", auditArgs, {
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

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const imageSizePatchPath =
  packageJson.pnpm?.patchedDependencies?.["image-size@1.2.1"];
const imageSizePatch = imageSizePatchPath
  ? readFileSync(imageSizePatchPath, "utf8")
  : "";
const imageSizeMitigationReady =
  imageSizePatch.includes("Invalid ICNS entry length") &&
  imageSizePatch.includes("boxSize < 8");
const locallyMitigated = new Set([
  "GHSA-5p2g-fcmc-qvqq",
  "GHSA-w3rx-r6r6-pgpr",
]);

const blocking = [];
for (const advisory of Object.values(report.advisories || {})) {
  if (
    imageSizeMitigationReady &&
    locallyMitigated.has(advisory.github_advisory_id)
  ) {
    continue;
  }
  if (!auditAll && !new Set(["critical", "high"]).has(advisory.severity)) {
    continue;
  }
  blocking.push(advisory);
}

if (blocking.length) {
  for (const advisory of blocking) {
    console.error(`${advisory.severity}: ${advisory.module_name} (${advisory.github_advisory_id})`);
  }
  process.exit(1);
}

console.log(
  auditAll
    ? "All workspaces: no unmitigated advisories"
    : "All production workspaces: 0 critical, 0 high advisories",
);
