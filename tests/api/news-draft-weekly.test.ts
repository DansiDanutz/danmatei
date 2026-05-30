import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockOpenAINotConfiguredError extends Error {
    constructor() {
      super("not configured");
      this.name = "OpenAINotConfiguredError";
    }
  }

  return {
    serviceClient: vi.fn(),
    getUserIdFromJwt: vi.fn(),
    isConfigured: vi.fn(),
    generateText: vi.fn(),
    OpenAINotConfiguredError: MockOpenAINotConfiguredError,
  };
});

vi.mock("../../api/_lib/supabase.js", () => ({
  serviceClient: mocks.serviceClient,
  getJwtFromHeader: vi.fn((header: string) =>
    header.replace(/^bearer\s+/i, "").trim(),
  ),
  getUserIdFromJwt: mocks.getUserIdFromJwt,
}));

vi.mock("../../api/_lib/openai.js", () => ({
  generateText: mocks.generateText,
  isConfigured: mocks.isConfigured,
  OpenAINotConfiguredError: mocks.OpenAINotConfiguredError,
}));

function resRecorder() {
  const calls: { status: number; body: unknown; headers: Record<string, string> }[] = [];
  const headers: Record<string, string> = {};
  const res = {
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    status(n: number) {
      return {
        json(body: unknown) {
          calls.push({ status: n, body, headers: { ...headers } });
          return res;
        },
      };
    },
  };
  return { res, calls };
}

function query(result: unknown) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    gte: vi.fn(() => q),
    not: vi.fn(() => q),
    order: vi.fn(() => q),
    limit: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  };
  return q;
}

function supabaseMock() {
  let scheduleEventCalls = 0;
  const recaps = {
    data: [
      {
        title: "U9 coordonare și pase",
        starts_at: "2026-05-29T15:00:00.000Z",
        recap_md: "Copiii au exersat pase rapide și schimbări de direcție.",
      },
    ],
    error: null,
  };
  const matches = {
    data: [
      {
        title: "Amical U11",
        starts_at: "2026-05-28T15:00:00.000Z",
        opponent: "Cluj Junior",
        match_results: [
          {
            our_score: 3,
            opponent_score: 2,
            recap_md: "Un meci echilibrat, decis pe final.",
          },
        ],
      },
    ],
    error: null,
  };
  const kids = {
    data: [
      {
        full_name: "Alex Pop",
        age_group_label: "U9",
      },
    ],
    error: null,
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return query({ data: { id: "owner-id", role: "owner" }, error: null });
      }
      if (table === "schedule_events") {
        scheduleEventCalls += 1;
        return query(scheduleEventCalls === 1 ? recaps : matches);
      }
      if (table === "children") return query(kids);
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

async function callDraft() {
  const { default: handler } = await import("../../api/news/draft-weekly");
  const { res, calls } = resRecorder();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer owner-token" },
    },
    res,
  );
  return calls[0];
}

describe("news weekly draft", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.serviceClient.mockReset();
    mocks.getUserIdFromJwt.mockReset();
    mocks.isConfigured.mockReset();
    mocks.generateText.mockReset();

    mocks.serviceClient.mockReturnValue(supabaseMock());
    mocks.getUserIdFromJwt.mockResolvedValue("owner-id");
  });

  it("returns a generated fallback draft when the LLM is not configured", async () => {
    mocks.isConfigured.mockReturnValue(false);

    const response = await callDraft();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      fallback: true,
      warning: "ai_not_configured",
      title: "Săptămână plină la Academia Dan Matei",
      sources: { recaps: 1, matches: 1, newFamilies: 1 },
    });
    expect((response.body as { body_md: string }).body_md).toContain(
      "U9 coordonare și pase",
    );
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("accepts fenced JSON from the LLM and returns it as the draft", async () => {
    mocks.isConfigured.mockReturnValue(true);
    mocks.generateText.mockResolvedValue(
      '```json\n{"title":"Săptămână excelentă pe teren","body_md":"Copiii au muncit bine și au progresat frumos."}\n```',
    );

    const response = await callDraft();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      fallback: false,
      title: "Săptămână excelentă pe teren",
      body_md: "Copiii au muncit bine și au progresat frumos.",
    });
  });

  it("falls back to a visible draft when the LLM request fails", async () => {
    mocks.isConfigured.mockReturnValue(true);
    mocks.generateText.mockRejectedValue(new Error("provider timeout"));

    const response = await callDraft();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      fallback: true,
      warning: "ai_generation_failed",
    });
    expect((response.body as { body_md: string }).body_md.length).toBeGreaterThan(80);
  });
});
