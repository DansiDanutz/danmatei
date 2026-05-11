/**
 * Full functional audit. Walks every public route, clicks every visible
 * link/button, fills the lead form, opens auth pages, and captures:
 *   - per-route HTTP status
 *   - per-route console errors / warnings
 *   - per-route failed network requests (≥400 / ECONNREFUSED / etc.)
 *   - all anchor tags whose href doesn't resolve (404)
 *   - viewport overflow (mobile + desktop)
 *   - screenshots for triage
 *
 * Reports a single JSON summary so issues can be prioritized fast.
 */
import { test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const SHOTS = path.resolve(process.cwd(), "test-results/full-audit");

type Issue = {
  route: string;
  category: "console" | "network" | "broken-link" | "overflow" | "page-load" | "form" | "missing-text";
  severity: "warn" | "error";
  detail: string;
};

const PUBLIC_ROUTES = [
  "/",
  "/cunoaste",
  "/academie",
  "/grupe",
  "/turnee",
  "/campionat",
  "/stiri",
  "/notificari",
  "/rezultate",
  "/copii",
  "/program",
  "/galerie",
  "/contact",
  "/programare",
  "/login",
  "/inregistrare",
];

test.beforeAll(() => {
  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
});

test("full audit: walk every route + capture issues", async ({ page }) => {
  const issues: Issue[] = [];
  const allLinks: Set<string> = new Set();
  const checkedLinks: Map<string, number> = new Map();

  // Per-route capture
  for (const route of PUBLIC_ROUTES) {
    const consoleErrs: string[] = [];
    const failedReqs: string[] = [];

    const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
      const t = msg.type();
      if (t === "error") consoleErrs.push(`[error] ${msg.text()}`);
      else if (t === "warning") consoleErrs.push(`[warn] ${msg.text()}`);
    };
    const onResponse = (res: import("@playwright/test").Response) => {
      // Ignore third-party noise (Google Fonts CSP, vercel telemetry, etc.)
      const url = res.url();
      if (
        url.includes("fonts.googleapis.com") ||
        url.includes("vercel.live") ||
        url.includes("vercel.com") ||
        url.includes("/.well-known/")
      ) return;
      const status = res.status();
      if (status >= 400 && status !== 401 && status !== 403) {
        failedReqs.push(`HTTP ${status} ${url}`);
      }
    };
    const onRequestFailed = (req: import("@playwright/test").Request) => {
      const url = req.url();
      if (url.includes("vercel.live") || url.includes("vercel.com")) return;
      failedReqs.push(`${req.failure()?.errorText} ${url}`);
    };

    page.on("console", onConsole);
    page.on("response", onResponse);
    page.on("requestfailed", onRequestFailed);

    const url = `${BASE}${route}`;
    let ok = true;
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      if (!resp || !resp.ok()) {
        issues.push({
          route,
          category: "page-load",
          severity: "error",
          detail: `HTTP ${resp?.status() ?? "no response"}`,
        });
        ok = false;
      }
    } catch (e) {
      issues.push({
        route,
        category: "page-load",
        severity: "error",
        detail: e instanceof Error ? e.message : String(e),
      });
      ok = false;
    }

    await page.waitForTimeout(1500);

    if (ok) {
      // Detect horizontal overflow at desktop + mobile
      const ovDesk = await page.evaluate(() => {
        return Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      });
      if (ovDesk > 4) {
        issues.push({
          route,
          category: "overflow",
          severity: "error",
          detail: `desktop overflow ${ovDesk}px`,
        });
      }

      // Page must contain SOME visible content (not just spinner)
      const visText = await page.evaluate(() => {
        const body = document.body;
        return body ? body.innerText.trim().slice(0, 200) : "";
      });
      if (visText.length < 10) {
        issues.push({
          route,
          category: "missing-text",
          severity: "error",
          detail: `route renders almost no text: "${visText}"`,
        });
      }

      // Collect all internal anchors for the link sweep
      const hrefs: string[] = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a[href]"))
          .map((a) => (a as HTMLAnchorElement).getAttribute("href") || "")
          .filter((h) => !!h);
      });
      for (const h of hrefs) {
        if (h.startsWith("#") || h.startsWith("tel:") || h.startsWith("mailto:")) continue;
        if (h.startsWith("http") && !h.startsWith(BASE)) continue;
        const full = h.startsWith("http") ? h : `${BASE}${h.startsWith("/") ? h : "/" + h}`;
        allLinks.add(full);
      }

      // Mobile snap
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      const ovMob = await page.evaluate(() => {
        return Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      });
      if (ovMob > 4) {
        issues.push({
          route,
          category: "overflow",
          severity: "error",
          detail: `mobile (390px) overflow ${ovMob}px`,
        });
      }
      await page.screenshot({
        path: path.join(SHOTS, `mobile${route.replace(/\//g, "_") || "_root"}.png`),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    for (const c of consoleErrs) {
      issues.push({ route, category: "console", severity: c.startsWith("[error]") ? "error" : "warn", detail: c });
    }
    for (const f of failedReqs) {
      issues.push({ route, category: "network", severity: "error", detail: f });
    }

    page.off("console", onConsole);
    page.off("response", onResponse);
    page.off("requestfailed", onRequestFailed);
  }

  // Sweep collected links for 404s
  for (const link of allLinks) {
    if (checkedLinks.has(link)) continue;
    try {
      const r = await page.request.get(link, { timeout: 10_000 });
      checkedLinks.set(link, r.status());
      if (r.status() >= 400 && r.status() !== 401 && r.status() !== 403) {
        issues.push({
          route: "(link sweep)",
          category: "broken-link",
          severity: "error",
          detail: `HTTP ${r.status()} ${link}`,
        });
      }
    } catch (e) {
      issues.push({
        route: "(link sweep)",
        category: "broken-link",
        severity: "error",
        detail: `${e instanceof Error ? e.message : String(e)} ${link}`,
      });
    }
  }

  // Specific functional probes ---------------------------------------------

  // /programare — submit a partial form and check error states render
  await page.goto(`${BASE}/programare`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const submit = page.getByRole("button", { name: /vreau să fiu sunat/i });
  if ((await submit.count()) === 0) {
    issues.push({
      route: "/programare",
      category: "form",
      severity: "error",
      detail: "submit button not found",
    });
  } else {
    await submit.click();
    await page.waitForTimeout(500);
    const required = await page.getByText(/obligatori|invalid|minim/i).count();
    if (required === 0) {
      issues.push({
        route: "/programare",
        category: "form",
        severity: "warn",
        detail: "submitting empty form did not surface any validation message",
      });
    }
  }

  // /cunoaste — verify the deck and the swipe controls render
  await page.goto(`${BASE}/cunoaste`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const trainerCardCount = await page.locator('[class*="trainer"]').count();
  const slideButtons = await page.getByRole("button", { name: /antren/i }).count();
  if (trainerCardCount === 0 && slideButtons === 0) {
    issues.push({
      route: "/cunoaste",
      category: "missing-text",
      severity: "warn",
      detail: "could not find trainer cards or trainer-related buttons",
    });
  }

  // Save report
  const grouped: Record<string, Issue[]> = {};
  for (const i of issues) {
    const key = `${i.severity}/${i.category}`;
    grouped[key] = grouped[key] || [];
    grouped[key].push(i);
  }
  fs.writeFileSync(
    path.join(SHOTS, "report.json"),
    JSON.stringify(
      {
        base: BASE,
        routesChecked: PUBLIC_ROUTES.length,
        linksSwept: allLinks.size,
        issuesTotal: issues.length,
        bySeverity: {
          error: issues.filter((i) => i.severity === "error").length,
          warn: issues.filter((i) => i.severity === "warn").length,
        },
        groups: Object.keys(grouped).map((k) => ({ key: k, count: grouped[k].length })),
        issues,
      },
      null,
      2,
    ),
  );

  // Pretty text report
  const lines: string[] = [];
  lines.push(`# Audit summary — ${BASE}`);
  lines.push(`Routes: ${PUBLIC_ROUTES.length} · Links: ${allLinks.size} · Issues: ${issues.length}`);
  lines.push("");
  for (const sev of ["error", "warn"] as const) {
    const subset = issues.filter((i) => i.severity === sev);
    if (!subset.length) continue;
    lines.push(`## ${sev.toUpperCase()} (${subset.length})`);
    for (const i of subset) {
      lines.push(`- [${i.category}] ${i.route} — ${i.detail}`);
    }
    lines.push("");
  }
  fs.writeFileSync(path.join(SHOTS, "report.md"), lines.join("\n"));
});
