/**
 * Handler test for the coaching-digest cron's delivery accounting.
 *
 * Why this matters: the coaching_tips insert used to be unchecked. A failed
 * insert breaks per-day idempotency (no row → tomorrow's run can't see it),
 * yet the recipient still got a notification + push and was counted as
 * `delivered`. Only recipients whose tip row landed may be delivered.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serviceClient: vi.fn(),
  sendPushToUsers: vi.fn(),
}));

vi.mock("../../api/_lib/supabase.js", () => ({
  serviceClient: mocks.serviceClient,
}));

vi.mock("../../api/_lib/push.js", () => ({
  sendPushToUsers: mocks.sendPushToUsers,
}));

vi.mock("../../api/_lib/openai.js", () => ({
  generateText: vi.fn(),
  isConfigured: vi.fn(() => false),
}));

function resRecorder() {
  const calls: { status: number; body: unknown }[] = [];
  const res = {
    status(n: number) {
      return {
        json(body: unknown) {
          calls.push({ status: n, body });
          return res;
        },
      };
    },
  };
  return { res, calls };
}

/** Chainable, awaitable query builder that resolves to `result`. */
function query(result: unknown) {
  const q: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  for (const m of ["select", "eq", "in"]) q[m] = vi.fn(() => q);
  return q;
}

describe("coaching-digest delivery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.sendPushToUsers.mockReset();
    mocks.sendPushToUsers.mockResolvedValue({
      sent: 1,
      skipped: 0,
      removed: 0,
    });
  });

  it("skips notification, push and delivered count when a tip insert fails", async () => {
    const notifInsert = vi.fn(async () => ({ error: null }));
    const tipInsert = vi.fn(async (row: { recipient_id: string }) => ({
      error:
        row.recipient_id === "trainer-bad"
          ? { message: "duplicate key" }
          : null,
    }));
    mocks.serviceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "trainers") {
          return query({
            data: [
              { profile_id: "trainer-ok", age_min: 7, age_max: 9 },
              { profile_id: "trainer-bad", age_min: 7, age_max: 9 },
            ],
          });
        }
        if (table === "profiles") return query({ data: [] });
        if (table === "coaching_tips") {
          return { ...query({ data: [] }), insert: tipInsert };
        }
        if (table === "notifications") return { insert: notifInsert };
        throw new Error(`unexpected table ${table}`);
      }),
    });

    const { default: handler } = await import("../../api/cron/coaching-digest");
    const { res, calls } = resRecorder();
    await handler({ method: "GET", headers: {} }, res);

    expect(calls[0].status).toBe(200);
    expect(calls[0].body).toMatchObject({
      recipients: 2,
      delivered: 1,
      failed: 1,
    });
    const notifRows = (notifInsert.mock.calls[0] as unknown[])[0] as {
      recipient_id: string;
    }[];
    expect(notifRows.map(r => r.recipient_id)).toEqual(["trainer-ok"]);
    expect(mocks.sendPushToUsers).toHaveBeenCalledTimes(1);
    expect(mocks.sendPushToUsers.mock.calls[0][0]).toEqual(["trainer-ok"]);
  });
});
