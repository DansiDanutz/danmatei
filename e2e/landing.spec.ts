import { test, expect } from "@playwright/test";

test.describe("Landing Hero (Home page)", () => {
  test.beforeEach(async ({ page }) => {
    // Use ?stay=1 to prevent the 5s auto-redirect
    await page.goto("/?stay=1");
  });

  test("renders hero card with title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Școala de Fotbal/ })).toBeVisible();
  });

  test("shows owner name Dan Matei", async ({ page }) => {
    await expect(page.getByText("Dan Matei")).toBeVisible();
  });

  test("shows UEFA badge", async ({ page }) => {
    await expect(page.getByText(/Licență UEFA/)).toBeVisible();
  });

  test("renders stat strip grid", async ({ page }) => {
    const statGrid = page.locator(".grid.grid-cols-3");
    await expect(statGrid).toBeVisible();
  });

  test("skip button is visible", async ({ page }) => {
    // The "Sări peste" skip pill
    const skipButton = page.getByRole("button", { name: /Sări peste/i });
    await expect(skipButton).toBeVisible({ timeout: 3000 });
  });

  test("clicking skip navigates to /cunoaste", async ({ page }) => {
    await page.getByRole("button", { name: /Sări peste/i }).click();
    await expect(page).toHaveURL(/\/cunoaste/);
  });

  test("hero logo image loads", async ({ page }) => {
    const logo = page.locator('img[alt="Școala Dan Matei"]');
    await expect(logo).toBeVisible();
    const src = await logo.getAttribute("src");
    expect(src).toBeTruthy();
  });

  test("stat values are visible", async ({ page }) => {
    // Should show stat strip values (use more specific locator to avoid matching "Din 2017" badge)
    const statGrid = page.locator(".grid.grid-cols-3");
    await expect(statGrid).toBeVisible();
    // At least one stat value should be present
    const statValues = statGrid.locator(".font-heading.tabular-nums");
    await expect(statValues.first()).toBeVisible();
  });
});
