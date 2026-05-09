import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const PREVIEW_URL =
  process.env.PREVIEW_URL ??
  "https://danmatei-git-claude-install-hyp-15b6fb-irises-projects-ce549f63.vercel.app/mobile-preview.html";

const SHOTS_DIR = path.resolve(process.cwd(), "test-results/preview-audit");

test.beforeAll(() => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
});

test("desktop full page + section shots + console errors", async ({
  page,
}) => {
  const consoleMsgs: string[] = [];
  const failedRequests: string[] = [];

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

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PREVIEW_URL, { waitUntil: "networkidle", timeout: 60000 });

  // Let videos / animations settle
  await page.waitForTimeout(3000);

  // Full page
  await page.screenshot({
    path: path.join(SHOTS_DIR, "00-fullpage.png"),
    fullPage: true,
  });

  const sections = ["hero", "hyper", "trainers", "onboarding", "auth", "tabs"];
  for (const id of sections) {
    const el = page.locator(`#${id}`);
    if ((await el.count()) > 0) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await el.screenshot({
        path: path.join(SHOTS_DIR, `10-${id}.png`),
      });
    }
  }

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PREVIEW_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(SHOTS_DIR, "20-mobile-fullpage.png"),
    fullPage: true,
  });

  // Write log
  fs.writeFileSync(
    path.join(SHOTS_DIR, "console.log"),
    [
      `URL: ${PREVIEW_URL}`,
      "",
      "=== Console messages ===",
      ...consoleMsgs,
      "",
      "=== Failed requests ===",
      ...failedRequests,
    ].join("\n"),
  );
});
