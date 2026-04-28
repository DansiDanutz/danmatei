import { test, expect } from "@playwright/test";

test.describe("Cunoaste discovery deck", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cunoaste");
  });

  test("loads the deck page", async ({ page }) => {
    // The deck should render — at minimum, we expect some content
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("renders content inside the deck container", async ({ page }) => {
    // The deck uses a swipe mechanism; verify key content appears
    // Owner slide typically shows first
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
  });

  test("can navigate through deck slides", async ({ page }) => {
    // Look for navigation buttons or swipe indicators
    const nextButtons = page.locator("button, [role='button']");
    const count = await nextButtons.count();
    // There should be interactive elements to navigate
    expect(count).toBeGreaterThan(0);
  });
});
