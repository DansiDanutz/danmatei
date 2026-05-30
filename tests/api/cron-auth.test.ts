/**
 * Unit tests for requireCron — the shared cron authorization guard
 * (api/_lib/cron-auth).
 *
 * Why this matters: coaching-digest and schedule-reminder previously failed
 * OPEN when CRON_SECRET was unset (anyone could trigger LLM-credit drain +
 * push/DB spam). requireCron must fail CLOSED in production/preview, accept the
 * exact `Bearer <secret>` Vercel sends, reject everything else, and stay
 * testable (allow) only in local dev when no secret is configured.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { requireCron } from "../../api/_lib/cron-auth";

function makeRes() {
  const calls: { status: number; body: unknown }[] = [];
  const res = {
    status(n: number) {
      return {
        json(body: unknown) {
          calls.push({ status: n, body });
          return body;
        },
      };
    },
  };
  return { res, calls };
}

const ORIGINAL_ENV = { ...process.env };

describe("requireCron", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NODE_ENV;
    delete process.env.VERCEL_ENV;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("accepts the exact Bearer secret", () => {
    process.env.CRON_SECRET = "s3cret";
    const { res, calls } = makeRes();
    const ok = requireCron(
      { headers: { authorization: "Bearer s3cret" } },
      res
    );
    expect(ok).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("rejects a wrong/absent token with 401 when a secret is set", () => {
    process.env.CRON_SECRET = "s3cret";
    const { res, calls } = makeRes();
    const ok = requireCron({ headers: { authorization: "Bearer nope" } }, res);
    expect(ok).toBe(false);
    expect(calls[0].status).toBe(401);
  });

  it("fails CLOSED with 503 in production when CRON_SECRET is unset", () => {
    process.env.NODE_ENV = "production";
    const { res, calls } = makeRes();
    const ok = requireCron({ headers: {} }, res);
    expect(ok).toBe(false);
    expect(calls[0].status).toBe(503);
  });

  it("fails CLOSED with 503 on Vercel preview when CRON_SECRET is unset", () => {
    process.env.VERCEL_ENV = "preview";
    const { res, calls } = makeRes();
    const ok = requireCron({ headers: {} }, res);
    expect(ok).toBe(false);
    expect(calls[0].status).toBe(503);
  });

  it("allows in local dev (no secret, no prod/preview env)", () => {
    const { res, calls } = makeRes();
    const ok = requireCron({ headers: {} }, res);
    expect(ok).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("handles a header array (multi-value) without crashing", () => {
    process.env.CRON_SECRET = "s3cret";
    const { res } = makeRes();
    const ok = requireCron(
      { headers: { authorization: ["Bearer s3cret"] } },
      res
    );
    expect(ok).toBe(true);
  });
});
