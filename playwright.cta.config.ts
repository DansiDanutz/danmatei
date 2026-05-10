import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /programare-cta\.spec\.ts/,
  reporter: [["list"]],
  timeout: 60_000,
  use: { trace: "off", screenshot: "off", ignoreHTTPSErrors: true },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
