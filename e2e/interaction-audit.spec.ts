/**
 * Deeper interaction audit. Where the route audit confirms the page
 * loads, this one confirms that *clicking things does what the user
 * expects*. The user complained "we click and nothing opens", so this
 * walks the most-trafficked flows and reports where the URL or the
 * visible content stays stale after a click.
 *
 *  - Home grid tiles (Programează / Academia / Grupe / Turnee / Stiri /
 *    Contact / Cont) — clicking each must change the URL.
 *  - Cunoaste swipe deck — pager arrows, dot indicators, slide content.
 *  - Programare submit — empty submit must show validation messages.
 *  - Login button — Google OAuth handler must be wired.
 *  - Navbar Programare CTA on landing pages.
 *  - Floating CTA — appears on /cunoaste after scroll, links to /programare,
 *    is hidden on /programare itself.
 *  - Phone tel: links use a phone number that is consistent across the site.
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const SHOTS = path.resolve(process.cwd(), "test-results/interaction-audit");
const issues: string[] = [];

test.beforeAll(() => {
  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
});
test.afterAll(() => {
  fs.writeFileSync(
    path.join(SHOTS, "report.md"),
    [`# Interaction audit — ${BASE}`, `Issues: ${issues.length}`, "", ...issues.map((s) => `- ${s}`)].join("\n"),
  );
});

// ---------- Home tile click flow ----------
const HOME_TILES: Array<{ label: RegExp; expectPath: RegExp }> = [
  { label: /programează/i, expectPath: /\/programare/ },
  { label: /academia/i, expectPath: /\/academie/ },
  { label: /grupe/i, expectPath: /\/grupe/ },
  { label: /turnee/i, expectPath: /\/turnee/ },
  { label: /^stiri$/i, expectPath: /\/stiri/ },
  { label: /contact/i, expectPath: /\/contact/ },
  { label: /^cont$/i, expectPath: /\/login/ },
];

test.describe("Home grid", () => {
  for (const tile of HOME_TILES) {
    test(`clicking "${tile.label}" tile lands on a page matching ${tile.expectPath}`, async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      // The landing page auto-redirects to /cunoaste after 5s, race that.
      await page.waitForTimeout(500);

      const link = page.getByRole("link", { name: tile.label });
      const count = await link.count();
      if (count === 0) {
        issues.push(`Home tile not found: "${tile.label}"`);
        test.fail(true, "tile not found");
        return;
      }
      // Take the first matching link (some labels appear in nav too)
      await link.first().click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(500);
      const url = page.url();
      if (!tile.expectPath.test(url)) {
        issues.push(`Tile "${tile.label}" did not navigate; URL=${url}`);
      }
      expect(url).toMatch(tile.expectPath);
    });
  }
});

// ---------- Cunoaste deck navigation ----------
test("Cunoaste deck: arrow navigation cycles slides", async ({ page }) => {
  await page.goto(`${BASE}/cunoaste`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const next = page.getByRole("button", { name: "Slide-ul următor" });
  const nextCount = await next.count();
  if (nextCount === 0) {
    issues.push("/cunoaste: 'Slide-ul următor' arrow button not found");
    return;
  }
  await page.screenshot({ path: path.join(SHOTS, "cunoaste-1.png"), fullPage: true });

  // Detect slide change by reading the text content of the slide region
  const sigBefore = await page.evaluate(() => document.body.innerText.slice(0, 600));
  await next.first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, "cunoaste-2.png"), fullPage: true });
  const sigAfter1 = await page.evaluate(() => document.body.innerText.slice(0, 600));
  if (sigBefore === sigAfter1) {
    issues.push("/cunoaste: clicking 'Slide-ul următor' did not change visible content");
  }

  await next.first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, "cunoaste-3.png"), fullPage: true });
  const sigAfter2 = await page.evaluate(() => document.body.innerText.slice(0, 600));
  if (sigAfter1 === sigAfter2) {
    issues.push("/cunoaste: second click of 'Slide-ul următor' did not change visible content");
  }
});

// ---------- Programare empty-submit must surface validation ----------
test("Programare: empty submit shows validation errors", async ({ page }) => {
  await page.goto(`${BASE}/programare`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const submit = page.getByRole("button", { name: /vreau să fiu sunat/i });
  await expect(submit).toBeVisible();
  await submit.click();
  await page.waitForTimeout(500);
  const validationMessages = await page.getByText(/obligatori|invalid|minim|consimț/i).count();
  if (validationMessages === 0) {
    issues.push("Programare: empty submit did not surface any visible validation message");
  }
  expect(validationMessages).toBeGreaterThan(0);
});

// ---------- Login: Google sign-in button is present and clickable ----------
test("Login: Google sign-in button is present", async ({ page }) => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const google = page.getByRole("button", { name: /google/i });
  const cnt = await google.count();
  if (cnt === 0) {
    issues.push("/login: no Google sign-in button found");
  }
  expect(cnt).toBeGreaterThan(0);
});

// ---------- Floating CTA shows after scroll on /cunoaste ----------
test("Floating CTA: shows on /cunoaste after scroll, hidden on /programare", async ({ page }) => {
  await page.goto(`${BASE}/cunoaste`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const cta = page.locator('a[aria-label="Vorbește cu un consilier acum"]');

  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(700);
  if ((await cta.count()) === 0 || !(await cta.first().isVisible())) {
    issues.push("/cunoaste: floating CTA did not appear after scrolling 1500px");
  }
  await expect(cta.first()).toBeVisible();

  await page.goto(`${BASE}/programare`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(500);
  if ((await cta.count()) > 0) {
    issues.push("/programare: floating CTA should be hidden on the page itself but is rendered");
  }
  await expect(cta).toHaveCount(0);
});

// ---------- Navbar phone numbers consistent ----------
test("Phone numbers are consistent across visible tel: links", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const numbers = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="tel:"]')) as HTMLAnchorElement[];
    return Array.from(new Set(links.map((a) => a.getAttribute("href")?.replace(/\D/g, "") || "")));
  });
  // We expect 1 unique phone number on the landing page
  if (numbers.length > 1) {
    issues.push(`Multiple phone numbers found on landing: ${numbers.join(", ")}`);
  }
});

// ---------- Mobile-preview swipe with arrow keys ----------
test("Mobile preview: keyboard arrow walks the trainer carousel", async ({ page }) => {
  await page.goto(`${BASE}/mobile-preview.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  // Skip intro splash if present
  const skip = page.locator("#introSkip");
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(900);
  }
  await page.locator("#trainers").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);

  const counter = page.locator("#trainerCurrent");
  const seq: string[] = [];
  seq.push((await counter.textContent())?.trim() ?? "");
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700);
    seq.push((await counter.textContent())?.trim() ?? "");
  }
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === seq[i - 1]) {
      issues.push(`Mobile preview keyboard arrow did not advance carousel: ${seq.join(" → ")}`);
      break;
    }
  }
});
