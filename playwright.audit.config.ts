import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    /full-audit\.spec\.ts/,
    /interaction-audit\.spec\.ts/,
    /preview-audit\.spec\.ts/,
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "html",
  timeout: 60_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: "http://localhost:3030",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3030",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
