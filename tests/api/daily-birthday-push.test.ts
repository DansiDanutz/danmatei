/**
 * Handler test for the daily cron's birthday push gating.
 *
 * Why this matters: when the batch birthday `notifications` insert failed,
 * the cron only logged and still sent the per-child birthday push. Like the
 * RSVP path in the same file, push must be gated on the insert succeeding.
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
  for (const m of ["select", "eq", "is", "gte", "lte", "not", "in", "like"]) {
    q[m] = vi.fn(() => q);
  }
  return q;
}

/** Today's YYYY-MM-DD in Europe/Bucharest, with the year swapped for 2015. */
function dobToday(): string {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Bucharest",
  });
  return `2015${today.slice(4)}`;
}

function supabaseWithBirthday(insertError: { message: string } | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "children") {
        return query({
          data: [
            {
              id: "kid-1",
              full_name: "Alex Pop",
              dob: dobToday(),
              parent_id: "parent-1",
              trainer: { profile_id: "trainer-1" },
            },
          ],
          error: null,
        });
      }
      if (table === "notifications") {
        return { insert: vi.fn(async () => ({ error: insertError })) };
      }
      // RSVP half: no trainings in the window.
      if (table === "schedule_events") return query({ data: [] });
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

async function runDaily() {
  const { default: handler } = await import("../../api/cron/daily");
  const { res, calls } = resRecorder();
  await handler({ method: "GET", headers: {} }, res);
  return calls[0];
}

describe("daily cron birthday push", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.sendPushToUsers.mockReset();
    mocks.sendPushToUsers.mockResolvedValue({
      sent: 2,
      skipped: 0,
      removed: 0,
    });
  });

  it("sends the birthday push when the notification insert succeeds", async () => {
    mocks.serviceClient.mockReturnValue(supabaseWithBirthday(null));
    const call = await runDaily();
    expect(call.status).toBe(200);
    expect(mocks.sendPushToUsers).toHaveBeenCalledTimes(1);
  });

  it("does NOT send the birthday push when the notification insert fails", async () => {
    mocks.serviceClient.mockReturnValue(
      supabaseWithBirthday({ message: "insert failed" })
    );
    const call = await runDaily();
    expect(call.status).toBe(200);
    expect(mocks.sendPushToUsers).not.toHaveBeenCalled();
  });
});
