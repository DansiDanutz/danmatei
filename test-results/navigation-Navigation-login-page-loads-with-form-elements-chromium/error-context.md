# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Navigation >> login page loads with form elements
- Location: e2e/navigation.spec.ts:27:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - link "Acasă" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e7]: Școala Dan Matei
      - link "Acasă" [ref=e8] [cursor=pointer]:
        - /url: /
        - img [ref=e9]
        - text: Acasă
    - main [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e15]: Cont membru
        - heading "Bine ai revenit la academie" [level=1] [ref=e17]:
          - generic [ref=e18]: Bine ai revenit la
          - text: academie
        - paragraph [ref=e19]: Conectează-te ca să accesezi profilul copilului, programul și mesajele de la antrenor.
        - generic [ref=e21]:
          - generic [ref=e22]:
            - generic [ref=e23]: Email
            - textbox "Email" [ref=e24]:
              - /placeholder: parinte@email.ro
          - generic [ref=e25]:
            - generic [ref=e26]: Parolă
            - textbox "Parolă" [ref=e27]:
              - /placeholder: ••••••••
          - button "Conectează-te" [ref=e28] [cursor=pointer]:
            - text: Conectează-te
            - img [ref=e29]
        - generic [ref=e31]:
          - text: Cont nou?
          - link "Înregistrează-te" [ref=e32] [cursor=pointer]:
            - /url: /inregistrare
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Navigation", () => {
  4  |   test("phone link exists in the page", async ({ page }) => {
  5  |     await page.goto("/?stay=1");
  6  |     const phoneLink = page.locator('a[href^="tel:"]');
  7  |     // May or may not be on the hero card page
  8  |     const count = await phoneLink.count();
  9  |     expect(count).toBeGreaterThanOrEqual(0);
  10 |   });
  11 | 
  12 |   test("cunoaste page loads after redirect", async ({ page }) => {
  13 |     await page.goto("/");
  14 |     // Wait for auto-redirect to /cunoaste
  15 |     await page.waitForURL(/\/cunoaste/, { timeout: 8000 });
  16 |     await expect(page.locator("body")).not.toBeEmpty();
  17 |   });
  18 | 
  19 |   test("dashboard redirects unauthenticated users", async ({ page }) => {
  20 |     await page.goto("/dashboard");
  21 |     // Should end up on login or stay on a redirect page
  22 |     await page.waitForTimeout(2000);
  23 |     const url = page.url();
  24 |     expect(url).toMatch(/\/(login|dashboard)/);
  25 |   });
  26 | 
  27 |   test("login page loads with form elements", async ({ page }) => {
  28 |     await page.goto("/login");
  29 |     const formElements = page.locator("input");
  30 |     const count = await formElements.count();
> 31 |     expect(count).toBeGreaterThan(0);
     |                   ^ Error: expect(received).toBeGreaterThan(expected)
  32 |   });
  33 | });
  34 | 
```