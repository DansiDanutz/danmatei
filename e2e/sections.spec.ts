import { test, expect } from "@playwright/test";

test.describe("Landing page sections", () => {
  test("all images have alt text", async ({ page }) => {
    await page.goto("/?stay=1");
    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt).toBeTruthy();
    }
  });

  test("page has proper heading structure", async ({ page }) => {
    await page.goto("/?stay=1");
    const h1 = page.locator("h1");
    const count = await h1.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("interactive elements exist", async ({ page }) => {
    await page.goto("/?stay=1");
    const buttons = page.locator("button, a[href], [role='button']");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("cunoaste page renders content", async ({ page }) => {
    await page.goto("/cunoaste");
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });
});
