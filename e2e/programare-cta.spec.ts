/**
 * Verifies the lead-capture flow is reachable from the landing pages
 * and that the floating CTA appears (after scroll) and is hidden on
 * /programare itself.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4173";

test("/programare page renders the lead form", async ({ page }) => {
  await page.goto(`${BASE}/programare`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByPlaceholder("ex. Andrei Popescu")).toBeVisible();
  await expect(page.getByPlaceholder("07XX XXX XXX")).toBeVisible();
  await expect(page.getByRole("button", { name: /vreau să fiu sunat/i })).toBeVisible();
});

test("floating Programare CTA appears after scroll on landing pages", async ({
  page,
}) => {
  await page.goto(`${BASE}/cunoaste`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const cta = page.locator('a[aria-label="Vorbește cu un consilier acum"]');
  // Hidden initially (or showing only at scrollY > 600)
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(500);
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/programare");
});

test("floating CTA is hidden on /programare itself", async ({ page }) => {
  await page.goto(`${BASE}/programare`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(500);
  const cta = page.locator('a[aria-label="Vorbește cu un consilier acum"]');
  await expect(cta).toHaveCount(0);
});
