import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /role-smoke\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://127.0.0.1:3030",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "bash scripts/start-vite-local-supabase.sh",
    url: "http://127.0.0.1:3030",
    reuseExistingServer: false,
    timeout: 45_000,
  },
});
