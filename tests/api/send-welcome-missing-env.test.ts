/**
 * send-welcome with the REAL api/_lib/supabase.ts (no mock), so the env check
 * is the one production runs. That module reads SUPABASE_URL and the anon key
 * when it is imported, so each test sets the env first and imports a fresh copy.
 *
 * A missing URL or anon key is a server config problem: 503
 * `supabase_unavailable`. It used to be answered as 401 `Not authenticated`,
 * because getUserIdFromJwt failed on the same check before the handler got
 * further. A genuinely bad token must still be 401.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CHILD = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const URL_VARS = ["SUPABASE_URL", "VITE_SUPABASE_URL"];
const ANON_VARS = ["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"];

const fetchMock = vi.fn();

function setEnv(url: string | undefined, anon: string | undefined) {
  for (const k of URL_VARS) vi.stubEnv(k, url as string);
  for (const k of ANON_VARS) vi.stubEnv(k, anon as string);
}

async function call(headers: Record<string, string> = {}) {
  vi.resetModules();
  const { default: handler } = await import("../../api/whatsapp/send-welcome");
  const out = { status: 0, body: undefined as any };
  const res = {
    status(n: number) {
      out.status = n;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
  };
  await handler(
    { method: "POST", headers, body: { childId: CHILD } },
    res as any
  );
  return out;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("send-welcome when the Supabase URL or anon key is missing", () => {
  it("answers 503 supabase_unavailable, not 401, and never calls Auth", async () => {
    setEnv(undefined, undefined);
    const r = await call({ authorization: "Bearer some-token" });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("supabase_unavailable");
    expect(r.body.message).toContain("SUPABASE_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 503 when only the anon key is missing", async () => {
    setEnv("https://project.supabase.co", undefined);
    const r = await call({ authorization: "Bearer some-token" });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("supabase_unavailable");
  });

  it("still answers 401 Missing bearer token first when there is no token", async () => {
    setEnv(undefined, undefined);
    const r = await call({});
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: "Missing bearer token" });
  });
});

describe("send-welcome with the Supabase env set", () => {
  it("still answers 401 Not authenticated for a token Auth rejects", async () => {
    setEnv("https://project.supabase.co", "anon-key");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    const r = await call({ authorization: "Bearer bad-token" });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: "Not authenticated" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
