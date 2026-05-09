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
