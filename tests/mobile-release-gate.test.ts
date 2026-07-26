import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mobilePackage = JSON.parse(readFileSync("apps/mobile/package.json", "utf8"));
const auditVerifier = readFileSync(
  "scripts/verify-production-dependencies.mjs",
  "utf8",
);
const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));

describe("mobile release dependency gate", () => {
  it("uses the supported Expo 57 runtime family", () => {
    expect(mobilePackage.dependencies.expo).toMatch(/^~57\./);
    expect(mobilePackage.dependencies["react-native"]).toBe("0.86.0");
    expect(mobilePackage.dependencies.react).toBe("19.2.3");
  });

  it("blocks every critical or high production advisory", () => {
    expect(auditVerifier).not.toContain("mobileOnly");
    expect(auditVerifier).toContain('new Set(["critical", "high"])');
    expect(auditVerifier).toContain("process.exit(1)");
  });

  it("runs the dependency gate before Vercel builds", () => {
    expect(vercelConfig.buildCommand).toBe(
      "pnpm audit:production && pnpm check && pnpm build",
    );
  });
});
