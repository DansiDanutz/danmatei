# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sections.spec.ts >> Landing page sections >> interactive elements exist
- Location: e2e/sections.spec.ts:21:3

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
  3  | test.describe("Landing page sections", () => {
  4  |   test("all images have alt text", async ({ page }) => {
  5  |     await page.goto("/?stay=1");
  6  |     const images = page.locator("img");
  7  |     const count = await images.count();
  8  |     for (let i = 0; i < count; i++) {
  9  |       const alt = await images.nth(i).getAttribute("alt");
  10 |       expect(alt).toBeTruthy();
  11 |     }
  12 |   });
  13 | 
  14 |   test("page has proper heading structure", async ({ page }) => {
  15 |     await page.goto("/?stay=1");
  16 |     const h1 = page.locator("h1");
  17 |     const count = await h1.count();
  18 |     expect(count).toBeGreaterThanOrEqual(1);
  19 |   });
  20 | 
  21 |   test("interactive elements exist", async ({ page }) => {
  22 |     await page.goto("/?stay=1");
  23 |     const buttons = page.locator("button, a[href], [role='button']");
  24 |     const count = await buttons.count();
> 25 |     expect(count).toBeGreaterThan(0);
     |                   ^ Error: expect(received).toBeGreaterThan(expected)
  26 |   });
  27 | 
  28 |   test("cunoaste page renders content", async ({ page }) => {
  29 |     await page.goto("/cunoaste");
  30 |     await page.waitForTimeout(1000);
  31 |     const body = await page.textContent("body");
  32 |     expect(body).toBeTruthy();
  33 |     expect(body!.length).toBeGreaterThan(0);
  34 |   });
  35 | });
  36 | 
```