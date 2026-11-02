/**
 * CORS for the mobile profile and chat routes (Expo Web). Runs real handlers
 * built by mobileRoute with a fake request and response.
 *
 * Browsers hide any response that lacks Access-Control-Allow-Origin, so the
 * headers must be on error responses (401, 405) as well as on success.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/supabase.js", () => ({
  getAuthUser: vi.fn(async () => ({ id: "u1", email: "a@b.ro" })),
  getJwtFromHeader: (h?: string) => h?.replace(/^Bearer\s+/i, "") || null,
}));

import { allowedWebOrigins, mobileRoute } from "../../api/_lib/mobile-api";

const handler = mobileRoute("test", ["GET", "POST"], async ({ res }) => {
  res.status(200).json({ ok: true });
});

function call(method: string, headers: Record<string, string> = {}) {
  const out = {
    status: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    ended: false,
  };
  const res = {
    status(n: number) {
      out.status = n;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
    end() {
      out.ended = true;
    },
    setHeader(k: string, v: string) {
      out.headers[k] = v;
    },
  };
  return handler({ method, headers }, res).then(() => out);
}

const WEB = "http://localhost:8081";

afterEach(() => {
  delete process.env.MOBILE_WEB_ORIGINS;
});

describe("allowedWebOrigins", () => {
  it("defaults to the Expo Web dev origins", () => {
    expect(allowedWebOrigins()).toEqual([
      "http://localhost:8081",
      "http://localhost:19006",
    ]);
  });

  it("adds MOBILE_WEB_ORIGINS, trimmed and without trailing slashes", () => {
    process.env.MOBILE_WEB_ORIGINS =
      " https://app.danmatei.ro/ , ,https://m.danmatei.ro";
    expect(allowedWebOrigins().slice(2)).toEqual([
      "https://app.danmatei.ro",
      "https://m.danmatei.ro",
    ]);
  });
});

describe("preflight", () => {
  it("answers 204 with the allow headers, without a bearer token", async () => {
    const r = await call("OPTIONS", {
      origin: WEB,
      "access-control-request-method": "POST",
    });
    expect(r.status).toBe(204);
    expect(r.ended).toBe(true);
    expect(r.headers["Access-Control-Allow-Origin"]).toBe(WEB);
    expect(r.headers["Access-Control-Allow-Methods"]).toBe(
      "GET, POST, OPTIONS"
    );
    expect(r.headers["Access-Control-Allow-Headers"]).toBe(
      "Authorization, Content-Type"
    );
    expect(r.headers["Access-Control-Max-Age"]).toBe("600");
    expect(r.headers.Vary).toBe("Origin");
  });

  it("gives an unlisted origin no allow headers", async () => {
    const r = await call("OPTIONS", { origin: "https://evil.example" });
    expect(r.status).toBe(204);
    expect(r.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(r.headers["Access-Control-Allow-Methods"]).toBeUndefined();
  });

  it("allows an origin listed in MOBILE_WEB_ORIGINS", async () => {
    process.env.MOBILE_WEB_ORIGINS = "https://app.danmatei.ro";
    const r = await call("OPTIONS", { origin: "https://app.danmatei.ro" });
    expect(r.headers["Access-Control-Allow-Origin"]).toBe(
      "https://app.danmatei.ro"
    );
  });
});

describe("actual requests", () => {
  it("adds the origin header to a success response", async () => {
    const r = await call("GET", { origin: WEB, authorization: "Bearer t" });
    expect(r.status).toBe(200);
    expect(r.headers["Access-Control-Allow-Origin"]).toBe(WEB);
    expect(r.headers["Access-Control-Expose-Headers"]).toBe("Retry-After");
  });

  it("adds it to a 401 so the browser can read the error", async () => {
    const r = await call("GET", { origin: WEB });
    expect(r.status).toBe(401);
    expect(r.headers["Access-Control-Allow-Origin"]).toBe(WEB);
  });

  it("adds it to a 405", async () => {
    const r = await call("DELETE", { origin: WEB, authorization: "Bearer t" });
    expect(r.status).toBe(405);
    expect(r.headers["Access-Control-Allow-Origin"]).toBe(WEB);
  });

  it("adds no allow-origin for an unlisted origin, and still enforces auth", async () => {
    const r = await call("GET", { origin: "https://evil.example" });
    expect(r.status).toBe(401);
    expect(r.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(r.headers.Vary).toBe("Origin");
  });

  it("adds no CORS headers when there is no Origin (native app)", async () => {
    const r = await call("GET", { authorization: "Bearer t" });
    expect(r.status).toBe(200);
    expect(r.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
