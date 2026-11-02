/**
 * Handler tests for GET and PUT /api/profile.
 *
 * `userClient` is a fake query builder (tests/api/_fake-supabase.ts), so these
 * prove mapping, validation and error handling. RLS itself is covered by the
 * pgTAP tests. `serviceClient` is a spy that fails the test if it is called:
 * the route must only ever query as the caller.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, makeReq, makeRes } from "./_fake-supabase";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  userClient: vi.fn(),
  serviceClient: vi.fn(() => {
    throw new Error("serviceClient must not be called");
  }),
}));

vi.mock("../../api/_lib/supabase.js", async importOriginal => {
  const actual =
    await importOriginal<typeof import("../../api/_lib/supabase.js")>();
  return {
    ...actual,
    getAuthUser: mocks.getAuthUser,
    userClient: mocks.userClient,
    serviceClient: mocks.serviceClient,
  };
});

import handler from "../../api/profile";

const ROW = {
  id: "u1",
  full_name: "Dan Matei",
  role: "parent",
  created_at: "2026-01-01T00:00:00Z",
};
const PROFILE = {
  id: "u1",
  fullName: "Dan Matei",
  email: "dan@example.com",
  role: "parent",
  createdAt: "2026-01-01T00:00:00Z",
};

function use(responses: Parameters<typeof fakeDb>[0]) {
  const db = fakeDb(responses);
  mocks.userClient.mockReturnValue(db.client);
  return db;
}

describe("/api/profile", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getAuthUser.mockReset();
    mocks.userClient.mockReset();
    mocks.serviceClient.mockClear();
    mocks.getAuthUser.mockResolvedValue({ id: "u1", email: "dan@example.com" });
  });

  afterEach(() => {
    expect(mocks.serviceClient).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  describe("authentication and method", () => {
    it("returns 405 for other methods before authenticating", async () => {
      const { res, out } = makeRes();
      await handler(makeReq({ method: "PATCH" }), res);
      expect(out.status).toBe(405);
      expect(out.body).toMatchObject({ error: "method_not_allowed" });
      expect(mocks.getAuthUser).not.toHaveBeenCalled();
    });

    it("returns 401 missing_bearer without a token", async () => {
      const { res, out } = makeRes();
      await handler(makeReq({ method: "GET", token: null }), res);
      expect(out.status).toBe(401);
      expect(out.body).toMatchObject({ error: "missing_bearer" });
      expect(mocks.userClient).not.toHaveBeenCalled();
    });

    it("returns 401 invalid_jwt when Auth rejects the token", async () => {
      mocks.getAuthUser.mockRejectedValue(new Error("Not authenticated"));
      const { res, out } = makeRes();
      await handler(makeReq({ method: "GET" }), res);
      expect(out.status).toBe(401);
      expect(out.body).toMatchObject({ error: "invalid_jwt" });
    });

    it("returns 401 invalid_jwt when Auth returns no email", async () => {
      mocks.getAuthUser.mockResolvedValue({ id: "u1", email: null });
      const { res, out } = makeRes();
      await handler(makeReq({ method: "GET" }), res);
      expect(out.status).toBe(401);
      expect(out.body).toMatchObject({ error: "invalid_jwt" });
    });
  });

  describe("GET", () => {
    it("returns the mapped profile with the email from Auth", async () => {
      const db = use({ "from:profiles": [{ data: ROW }] });
      const { res, out } = makeRes();
      await handler(makeReq({ method: "GET" }), res);
      expect(out.status).toBe(200);
      expect(out.body).toEqual(PROFILE);
      expect(mocks.userClient).toHaveBeenCalledWith("tok");
      // The explicit id filter keeps an owner (who can read every row) to one.
      expect(db.calls[0].chain).toEqual([
        ["select", ["id, full_name, role, created_at"]],
        ["eq", ["id", "u1"]],
        ["maybeSingle", []],
      ]);
    });

    it("returns 404 not_found when there is no profile row", async () => {
      use({ "from:profiles": [{ data: null }] });
      const { res, out } = makeRes();
      await handler(makeReq({ method: "GET" }), res);
      expect(out.status).toBe(404);
      expect(out.body).toMatchObject({ error: "not_found" });
    });

    it("returns 500 server_error without echoing database text", async () => {
      use({
        "from:profiles": [
          { error: { message: "secret column x", code: "XX000" } },
        ],
      });
      const { res, out } = makeRes();
      await handler(makeReq({ method: "GET" }), res);
      expect(out.status).toBe(500);
      expect(out.body).toEqual({
        error: "server_error",
        message: "Eroare de server.",
      });
      expect(JSON.stringify(out.body)).not.toContain("secret");
    });
  });

  describe("PUT", () => {
    it("rejects role with 400 forbidden_fields and updates nothing", async () => {
      const db = use({});
      const { res, out } = makeRes();
      await handler(
        makeReq({
          method: "PUT",
          body: { fullName: "Dan Matei", role: "owner" },
        }),
        res
      );
      expect(out.status).toBe(400);
      expect(out.body).toEqual({
        error: "forbidden_fields",
        message: "Câmpuri nepermise: role.",
      });
      expect(db.calls).toHaveLength(0);
    });

    it("joins every rejected key in the message", async () => {
      use({});
      const { res, out } = makeRes();
      await handler(
        makeReq({ method: "PUT", body: { id: "x", email: "a@b.c" } }),
        res
      );
      expect(out.body).toMatchObject({
        message: "Câmpuri nepermise: id, email.",
      });
    });

    it.each([null, undefined, "fullName", ["fullName"], { fullName: "a" }, {}])(
      "rejects an invalid body (%j) with 400 invalid_body",
      async body => {
        const db = use({});
        const { res, out } = makeRes();
        await handler(makeReq({ method: "PUT", body }), res);
        expect(out.status).toBe(400);
        expect(out.body).toMatchObject({ error: "invalid_body" });
        expect(db.calls).toHaveLength(0);
      }
    );

    it("updates only full_name on the caller's row and returns the profile", async () => {
      const db = use({
        "from:profiles": [{ data: { ...ROW, full_name: "Dan Nou" } }],
      });
      const { res, out } = makeRes();
      await handler(
        makeReq({ method: "PUT", body: { fullName: "  Dan Nou " } }),
        res
      );
      expect(out.status).toBe(200);
      expect(out.body).toEqual({ ...PROFILE, fullName: "Dan Nou" });
      expect(db.calls[0].chain).toEqual([
        ["update", [{ full_name: "Dan Nou" }]],
        ["eq", ["id", "u1"]],
        ["select", ["id, full_name, role, created_at"]],
        ["maybeSingle", []],
      ]);
    });

    it("returns 404 when the update matches no row", async () => {
      use({ "from:profiles": [{ data: null }] });
      const { res, out } = makeRes();
      await handler(
        makeReq({ method: "PUT", body: { fullName: "Dan Matei" } }),
        res
      );
      expect(out.status).toBe(404);
      expect(out.body).toMatchObject({ error: "not_found" });
    });

    it("returns 500 when the update fails", async () => {
      use({ "from:profiles": [{ error: { message: "boom", code: "XX000" } }] });
      const { res, out } = makeRes();
      await handler(
        makeReq({ method: "PUT", body: { fullName: "Dan Matei" } }),
        res
      );
      expect(out.status).toBe(500);
      expect(out.body).toMatchObject({ error: "server_error" });
    });
  });
});
