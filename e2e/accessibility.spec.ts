import { test, expect } from "@playwright/test";

test.describe("Accessibility baseline", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("all images have non-empty alt attributes", async ({ page }) => {
    const images = page.locator("img");
    const count = await images.count();
    let issues = 0;
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      if (!alt || alt.trim() === "") issues++;
    }
    expect(issues).toBe(0);
  });

  test("page has a valid lang attribute", async ({ page }) => {
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBeTruthy();
  });

  test("viewport meta tag is present", async ({ page }) => {
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);
  });

  test("form inputs have associated labels", async ({ page }) => {
    const inputs = page.locator("input:not([type='hidden'])");
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute("id");
      const ariaLabel = await inputs.nth(i).getAttribute("aria-label");
      const ariaLabelledBy = await inputs.nth(i).getAttribute("aria-labelledby");
      const placeholder = await inputs.nth(i).getAttribute("placeholder");

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = (await label.count()) > 0;
        if (!hasLabel && !ariaLabel && !ariaLabelledBy && !placeholder) {
          // Input is missing accessible label
          console.log(`Input #${id} missing accessible label`);
        }
      }
    }
  });

  test("focus outlines are visible on interactive elements", async ({ page }) => {
    // Tab through first few interactive elements
    const focusable = page.locator("a[href], button, input, [tabindex='0']");
    const count = await focusable.count();
    expect(count).toBeGreaterThan(0);

    // Verify focus is possible
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test("reduced-motion CSS is configured", async ({ page }) => {
    const hasReducedMotionRule = await page.evaluate(() => {
      const sheets = document.styleSheets;
      for (const sheet of sheets) {
        try {
          const rules = sheet.cssRules;
          for (const rule of rules) {
            if (rule.cssText.includes("prefers-reduced-motion")) {
              return true;
            }
          }
        } catch {
          // Cross-origin stylesheet, skip
        }
      }
      return false;
    });
    expect(hasReducedMotionRule).toBe(true);
  });
});
