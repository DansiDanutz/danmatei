import { expect, test, type Page, type Route } from "@playwright/test";

const PASSWORD = "parola123";

const accounts = {
  owner: {
    email: "dan@scoala-dan-matei.ro",
    landing: /\/admin(?:[/?#]|$)/,
  },
  trainer: {
    email: "andrei@scoala-dan-matei.ro",
    landing: /\/antrenor(?:[/?#]|$)/,
  },
  parent: {
    email: "parinte@example.com",
    landing: /\/(copii|copil\/|inregistrare\/copil)(?:[/?#]|$)/,
  },
} as const;

const adminTabs = [
  "Antrenori",
  "Grupe",
  "Membri",
  "Risc",
  "Plăți",
  "Funnel",
  "Lead-uri",
  "Știri",
  "Program",
  "Notificări",
  "Pagina publică",
];

const trainerTabs = [
  "Grupa",
  "Atribuiri",
  "Program",
  "Meciuri",
  "Prezență",
  "Mesaje",
  "Profil",
  "Inbox AI",
  "AI · WhatsApp",
];

function analyticsPayload() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    days: 30,
    totals: {
      total: 0,
      contacted: 0,
      closed: 0,
      conversionRate: 0,
    },
    funnel: [
      { status: "new", count: 0, drop: 0 },
      { status: "contacted", count: 0, drop: 0 },
      { status: "closed", count: 0, drop: 0 },
    ],
    bySource: [],
    byIntent: [],
    byTrainer: [],
    timeSeries: [{ date: today, total: 0, contacted: 0 }],
  };
}

function leadInboxPayload() {
  const now = new Date().toISOString();
  return {
    ok: true,
    items: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        parent_name: "Maria Pop",
        parent_phone_e164: "+40700000000",
        child_name: "Alex Pop",
        child_age: 8,
        child_position: "atacant",
        status: "routed",
        assigned_trainer_id: "t-sopi",
        cc_trainer_ids: ["t-dan"],
        snoozed_until: null,
        created_at: now,
        latestCall: {
          id: "22222222-2222-4222-8222-222222222222",
          duration_seconds: 95,
          summary: "Părintele vrea un antrenament de probă pentru Alex.",
          transcript: [
            {
              role: "agent",
              text: "Bună, sunt Andra de la Academia Dan Matei.",
              started_at_ms: 0,
            },
            {
              role: "parent",
              text: "Bună, vreau să înscriu copilul la fotbal.",
              started_at_ms: 3200,
            },
          ],
          intent: "register",
          next_steps: ["Sună părintele și propune un antrenament de probă."],
          recording_url: null,
          status: "completed",
          created_at: now,
        },
      },
    ],
  };
}

function weeklyDraftPayload() {
  return {
    ok: true,
    title: "Săptămână bună pe teren",
    body_md:
      "Copiii au lucrat cu energie la antrenamente, iar familiile noi au fost primite cu bucurie în academie.",
    sources: { recaps: 1, matches: 0, newFamilies: 1 },
    fallback: false,
  };
}

async function installApiMocks(page: Page, unexpectedApiCalls: string[]) {
  await page.route("**/api/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (url.pathname === "/api/push/vapid-key") {
      await json({ configured: false, publicKey: null });
      return;
    }
    if (url.pathname === "/api/leads/analytics") {
      await json(analyticsPayload());
      return;
    }
    if (url.pathname === "/api/lead/list") {
      await json(leadInboxPayload());
      return;
    }
    if (url.pathname === "/api/news/draft-weekly") {
      await json(weeklyDraftPayload());
      return;
    }

    unexpectedApiCalls.push(`${route.request().method()} ${url.pathname}`);
    await json({ ok: true, items: [] });
  });
}

function collectPageFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("requestfailed", request => {
    const url = request.url();
    if (url.includes("/.well-known/")) return;
    if (url.includes("fonts.gstatic.com")) return;
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    failures.push(`request failed: ${request.failure()?.errorText} ${url}`);
  });
  page.on("response", response => {
    const url = response.url();
    if (url.includes("/.well-known/")) return;
    if (response.status() >= 400) {
      failures.push(`HTTP ${response.status()} ${url}`);
    }
  });
  return failures;
}

async function loginWithEmail(page: Page, account: keyof typeof accounts) {
  await page.goto("/login?email=1", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Email").fill(accounts[account].email);
  await page.getByPlaceholder("Parolă").fill(PASSWORD);
  await page.getByRole("button", { name: /^Conectează-te$/ }).click();
  await page.waitForURL(accounts[account].landing, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Deconectează-te" }).click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test.beforeEach(async ({ page }) => {
  const unexpectedApiCalls: string[] = [];
  await installApiMocks(page, unexpectedApiCalls);
  (page as Page & { unexpectedApiCalls?: string[] }).unexpectedApiCalls =
    unexpectedApiCalls;
});

test("owner can sign in and every admin tab renders", async ({ page }) => {
  await loginWithEmail(page, "owner");
  const failures = collectPageFailures(page);

  await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
  await expect(page.getByText("Panou proprietar")).toBeVisible();

  for (const tab of adminTabs) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator('[role="tabpanel"]:visible')).toBeVisible();

    if (tab === "Lead-uri") {
      await expect(page.getByText("Transcript conversație")).toBeVisible();
      await expect(
        page.getByText("Bună, vreau să înscriu copilul la fotbal.")
      ).toBeVisible();
    }

    if (tab === "Știri") {
      await page.getByRole("button", { name: /draft săptămânal/i }).click();
      await expect(page.locator("#n-title")).toHaveValue(
        "Săptămână bună pe teren"
      );
      await expect(page.locator("#n-body")).toHaveValue(
        /Copiii au lucrat cu energie/
      );
    }

    if (tab === "Program") {
      await expect(page.getByText("Adaugă antrenamente")).toBeVisible();
      await expect(
        page.getByText("Zile și ore pentru grupele active")
      ).toBeVisible();
    }
  }

  const unexpectedApiCalls =
    (page as Page & { unexpectedApiCalls?: string[] }).unexpectedApiCalls ?? [];
  expect(unexpectedApiCalls).toEqual([]);
  expect(failures).toEqual([]);
  await logout(page);
});

test("trainer can sign in and every trainer tab renders", async ({ page }) => {
  await loginWithEmail(page, "trainer");
  const failures = collectPageFailures(page);

  await expect(page.getByText("Panou antrenor")).toBeVisible();

  for (const tab of trainerTabs) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator('[role="tabpanel"]:visible')).toBeVisible();
  }

  const unexpectedApiCalls =
    (page as Page & { unexpectedApiCalls?: string[] }).unexpectedApiCalls ?? [];
  expect(unexpectedApiCalls).toEqual([]);
  expect(failures).toEqual([]);
  await logout(page);
});

test("parent can sign in and open seeded child profile", async ({ page }) => {
  await loginWithEmail(page, "parent");
  const failures = collectPageFailures(page);

  await expect(
    page.getByRole("heading", { name: /copiii tăi/i })
  ).toBeVisible();
  await expect(page.getByText("Andrei Popescu")).toBeVisible();

  await page
    .getByRole("link", { name: /profil complet/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/copil\//);
  await expect(
    page.getByRole("heading", { name: /Andrei Popescu|Sofia Popescu/ }).first()
  ).toBeVisible();

  const unexpectedApiCalls =
    (page as Page & { unexpectedApiCalls?: string[] }).unexpectedApiCalls ?? [];
  expect(unexpectedApiCalls).toEqual([]);
  expect(failures).toEqual([]);
});
