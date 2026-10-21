import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const auditAll = process.argv.includes("--all");
const auditArgs = ["audit", ...(auditAll ? [] : ["--prod"]), "--json"];
const audit = spawnSync("pnpm", auditArgs, {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  // pnpm is a .cmd shim on Windows, which spawnSync cannot run without a shell.
  shell: process.platform === "win32",
});

if (!audit.stdout?.trim()) {
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

if (
  audit.error ||
  audit.signal ||
  report.error ||
  !report.advisories ||
  !report.metadata
) {
  console.error(
    report.error?.summary ||
      report.error?.message ||
      audit.error?.message ||
      audit.stderr ||
      "pnpm audit did not return a complete advisory report",
  );
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

// Advisories accepted only while every finding path starts with one of the
// listed prefixes. None reaches the web app or /api; a new path fails the gate.
const toolchainOnly = new Map([
  // node-forge, braces: no upstream release; Expo CLI developer toolchain.
  ["GHSA-86w9-cpqp-85rv", ["apps__mobile>expo>@expo/cli>"]],
  ["GHSA-vfj7-8cjw-p6xm", ["apps__mobile>expo>@expo/cli>"]],
  // sprintf-js: no upstream release; hyperframes video-render CLI only.
  [
    "GHSA-hp3w-g68c-fv3c",
    [".>hyperframes>", "apps__mobile>hyperframes>"],
  ],
  // decode-uri-component: the fix (>=0.5) is ESM-only and breaks the
  // CommonJS query-string@7 that expo-router requires. Mobile app only.
  ["GHSA-vcc3-ghjq-m6fr", ["apps__mobile>expo-router>query-string>"]],
  // postcss-selector-parser: the fix (>=7.1.6) is a major that Tailwind 3 /
  // NativeWind don't support. Mobile build-time CSS only.
  [
    "GHSA-rj75-hqrm-r3gf",
    [
      "apps__mobile>tailwindcss>",
      "apps__mobile>nativewind>",
      "apps__mobile>react-native-css-interop>",
    ],
  ],
]);
const isToolchainOnly = (advisory) => {
  const prefixes = toolchainOnly.get(advisory.github_advisory_id);
  const paths = (advisory.findings || []).flatMap((f) => f.paths || []);
  return (
    Boolean(prefixes) &&
    paths.length > 0 &&
    paths.every((path) => prefixes.some((prefix) => path.startsWith(prefix)))
  );
};

const blocking = [];
for (const advisory of Object.values(report.advisories || {})) {
  if (
    imageSizeMitigationReady &&
    locallyMitigated.has(advisory.github_advisory_id)
  ) {
    continue;
  }
  if (isToolchainOnly(advisory)) {
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
