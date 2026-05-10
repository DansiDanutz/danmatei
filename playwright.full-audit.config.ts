import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /full-audit\.spec\.ts/,
  reporter: [["list"]],
  timeout: 600_000,
  use: { trace: "off", screenshot: "off", ignoreHTTPSErrors: true },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
