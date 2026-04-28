# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: landing.spec.ts >> Landing Hero (Home page) >> stat values are visible
- Location: e2e/landing.spec.ts:44:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('2017')
Expected: visible
Error: strict mode violation: getByText('2017') resolved to 2 elements:
    1) <span data-loc="client/src/pages/Home.tsx:73" class="inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1 font-heading text-[10px] uppercase tracking-[0.22em] text-brand-cyan">…</span> aka getByText('Licență UEFA · Din')
    2) <div data-loc="client/src/pages/Home.tsx:133" class="font-heading text-base font-bold tabular-nums text-brand-cyan">2017</div> aka getByText('2017', { exact: true })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('2017')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T"
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img "Școala Dan Matei" [ref=e8]
      - generic [ref=e9]: Acs · Cluj-Napoca
    - generic [ref=e11]:
      - generic [ref=e23]: Work Hard, Feel Good
      - generic [ref=e24]:
        - generic [ref=e25]: Licență UEFA · Din 2017
        - heading "Școala de Fotbal" [level=1] [ref=e27]
        - heading "Dan Matei" [level=2] [ref=e28]
        - paragraph [ref=e29]: Academia unde copiii devin fotbaliști — și oameni.
        - generic [ref=e30]:
          - generic [ref=e31]:
            - generic [ref=e32]: "2017"
            - generic [ref=e33]: Din
          - generic [ref=e34]:
            - generic [ref=e35]: 240+
            - generic [ref=e36]: Copii formați
          - generic [ref=e37]:
            - generic [ref=e38]: "18"
            - generic [ref=e39]: Trofee
    - paragraph [ref=e40]: Cunoști academia în câteva secunde
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Landing Hero (Home page)", () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Use ?stay=1 to prevent the 5s auto-redirect
  6  |     await page.goto("/?stay=1");
  7  |   });
  8  | 
  9  |   test("renders hero card with title", async ({ page }) => {
  10 |     await expect(page.getByRole("heading", { name: /Școala de Fotbal/ })).toBeVisible();
  11 |   });
  12 | 
  13 |   test("shows owner name Dan Matei", async ({ page }) => {
  14 |     await expect(page.getByText("Dan Matei")).toBeVisible();
  15 |   });
  16 | 
  17 |   test("shows UEFA badge", async ({ page }) => {
  18 |     await expect(page.getByText(/Licență UEFA/)).toBeVisible();
  19 |   });
  20 | 
  21 |   test("renders stat strip grid", async ({ page }) => {
  22 |     const statGrid = page.locator(".grid.grid-cols-3");
  23 |     await expect(statGrid).toBeVisible();
  24 |   });
  25 | 
  26 |   test("skip button is visible", async ({ page }) => {
  27 |     // The "Sări peste" skip pill
  28 |     const skipButton = page.getByRole("button", { name: /Sări peste/i });
  29 |     await expect(skipButton).toBeVisible({ timeout: 3000 });
  30 |   });
  31 | 
  32 |   test("clicking skip navigates to /cunoaste", async ({ page }) => {
  33 |     await page.getByRole("button", { name: /Sări peste/i }).click();
  34 |     await expect(page).toHaveURL(/\/cunoaste/);
  35 |   });
  36 | 
  37 |   test("hero logo image loads", async ({ page }) => {
  38 |     const logo = page.getByAlt("Școala Dan Matei");
  39 |     await expect(logo).toBeVisible();
  40 |     const src = await logo.getAttribute("src");
  41 |     expect(src).toBeTruthy();
  42 |   });
  43 | 
  44 |   test("stat values are visible", async ({ page }) => {
  45 |     // Should show at least "2017" and "+" values
> 46 |     await expect(page.getByText("2017")).toBeVisible();
     |                                          ^ Error: expect(locator).toBeVisible() failed
  47 |   });
  48 | });
  49 | 
```