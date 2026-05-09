import { test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const PREVIEW_URL =
  process.env.PREVIEW_URL ??
  "https://danmatei.vercel.app/mobile-preview.html";

const SHOTS_DIR = path.resolve(process.cwd(), "test-results/preview-audit");

const VIEWPORTS = [
  { name: "mobile-360", w: 360, h: 800 },
  { name: "mobile-390", w: 390, h: 844 },
  { name: "mobile-430", w: 430, h: 932 },
  { name: "tablet-768", w: 768, h: 1024 },
  { name: "desktop-1440", w: 1440, h: 900 },
];

const SECTIONS = ["hero", "hyper", "trainers", "onboarding", "auth", "tabs"];

test.beforeAll(() => {
  fs.rmSync(SHOTS_DIR, { recursive: true, force: true });
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
});

test("trainer carousel: each next-arrow click advances exactly one slide", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PREVIEW_URL, { waitUntil: "networkidle" });

  const skip = page.locator("#introSkip");
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(900);
  }

  await page.locator("#trainers").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const counter = page.locator("#trainerCurrent");
  const seq: string[] = [];
  seq.push((await counter.textContent())?.trim() ?? "");

  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => document.getElementById("trainerNext")?.click());
    await page.waitForTimeout(750);
    seq.push((await counter.textContent())?.trim() ?? "");
  }

  // Each click should advance the counter (loop wraps). Adjacent items differ.
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === seq[i - 1]) {
      throw new Error(`step ${i} did not advance: ${seq.join(" → ")}`);
    }
  }
});

test("intro splash skip button dismisses overlay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PREVIEW_URL, { waitUntil: "domcontentloaded" });
  const intro = page.locator("#intro");
  await intro.waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#introSkip").click();
  // wait for the fade transition + DOM removal
  await page.waitForTimeout(900);
  const stillThere = await page.locator("#intro").count();
  if (stillThere > 0) {
    const visible = await page.locator("#intro").isVisible();
    if (visible) throw new Error("intro splash did not dismiss");
  }
});

test("audit preview at every viewport", async ({ page }) => {
  const consoleMsgs: string[] = [];
  const failedRequests: string[] = [];
  const overflows: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.failure()?.errorText} ${req.url()}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      failedRequests.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto(PREVIEW_URL, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);

    // Trigger scroll-reveal animations by walking the page top → bottom
    await page.evaluate(async () => {
      const total = document.documentElement.scrollHeight;
      const step = window.innerHeight * 0.7;
      for (let y = 0; y <= total; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);

    // Detect horizontal overflow
    const docOverflow = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      return { docW, winW, overflow: Math.max(0, docW - winW) };
    });
    if (docOverflow.overflow > 0) {
      overflows.push(
        `[${vp.name}] horizontal overflow: ${docOverflow.overflow}px (doc ${docOverflow.docW}px vs viewport ${docOverflow.winW}px)`,
      );
    }

    // Full page
    await page.screenshot({
      path: path.join(SHOTS_DIR, `${vp.name}-fullpage.png`),
      fullPage: true,
    });

    // Section shots — only on a couple of viewports to keep size sane
    if (vp.name === "mobile-360" || vp.name === "desktop-1440") {
      for (const id of SECTIONS) {
        const el = page.locator(`#${id}`);
        if ((await el.count()) > 0) {
          await el.scrollIntoViewIfNeeded();
          await page.waitForTimeout(400);
          await el.screenshot({
            path: path.join(SHOTS_DIR, `${vp.name}-${id}.png`),
          });
        }
      }
    }
  }

  fs.writeFileSync(
    path.join(SHOTS_DIR, "console.log"),
    [
      `URL: ${PREVIEW_URL}`,
      "",
      "=== Horizontal overflow ===",
      ...overflows,
      "",
      "=== Console messages ===",
      ...consoleMsgs,
      "",
      "=== Failed requests ===",
      ...failedRequests,
    ].join("\n"),
  );
});
