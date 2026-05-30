#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["api", "client", "server", "services"];
const EXTRA_FILES = ["docker-compose.yml", "services/caddy/Caddyfile"];
const IGNORE = new Set(["DEV", "NODE_ENV", "PORT", "VERCEL_ENV"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__pycache__") continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const files = [...ROOTS.flatMap(root => walk(root)), ...EXTRA_FILES].filter(
  path => /\.(cjs|js|jsx|mjs|py|ts|tsx|yml|yaml|Caddyfile)$/.test(path)
);

const used = new Set();
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const match of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
    used.add(match[1]);
  }
  for (const match of src.matchAll(/process\.env\[['"]([A-Z0-9_]+)['"]\]/g)) {
    used.add(match[1]);
  }
  for (const match of src.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
    used.add(match[1]);
  }
  for (const match of src.matchAll(/os\.environ\.get\(['"]([A-Z0-9_]+)['"]/g)) {
    used.add(match[1]);
  }
  if (
    file.endsWith(".yml") ||
    file.endsWith(".yaml") ||
    file.endsWith("Caddyfile")
  ) {
    for (const match of src.matchAll(/\$\{([A-Z0-9_]+)/g)) {
      used.add(match[1]);
    }
  }
}

const example = readFileSync(".env.example", "utf8");
const documentedNames = [...example.matchAll(/^([A-Z0-9_]+)=/gm)].map(
  match => match[1]
);
const documented = new Set(documentedNames);
const duplicates = documentedNames
  .filter((name, index) => documentedNames.indexOf(name) !== index)
  .sort();

const missing = [...used]
  .filter(name => !IGNORE.has(name) && !documented.has(name))
  .sort();

if (missing.length > 0) {
  console.error(
    [
      ".env.example is missing variables read by the app/runtime:",
      ...missing.map(name => `  - ${name}`),
    ].join("\n")
  );
  process.exit(1);
}

if (duplicates.length > 0) {
  console.error(
    [
      ".env.example contains duplicate variable definitions:",
      ...duplicates.map(name => `  - ${name}`),
    ].join("\n")
  );
  process.exit(1);
}

console.log(
  `.env.example documents ${documented.size} variables used by runtime code.`
);
