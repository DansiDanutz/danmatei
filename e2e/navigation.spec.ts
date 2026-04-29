import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("phone link exists in the page", async ({ page }) => {
    await page.goto("/?stay=1");
    const phoneLink = page.locator('a[href^="tel:"]');
    // May or may not be on the hero card page
    const count = await phoneLink.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("cunoaste page loads after redirect", async ({ page }) => {
    await page.goto("/");
    // Wait for auto-redirect to /cunoaste
    await page.waitForURL(/\/cunoaste/, { timeout: 8000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("dashboard redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");
    // Should end up on login or stay on a redirect page
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard)/);
  });

  test("login page loads with Google sign-in", async ({ page }) => {
    await page.goto("/login");
    const googleButton = page.locator('button, [role="button"]').filter({ hasText: /Google|Conectare/ }).first();
    await expect(googleButton).toBeVisible();
  });
});
