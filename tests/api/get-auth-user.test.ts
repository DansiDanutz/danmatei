/**
 * Unit tests for getAuthUser and the getUserIdFromJwt that delegates to it
 * (api/_lib/supabase.ts), with fetch mocked.
 *
 * The module reads its env at import time, so each test stubs the env, resets
 * the module registry and imports it again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

async function load() {
  return import("../../api/_lib/supabase");
}

function authResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns the id and email, calling /auth/v1/user with the token", async () => {
    fetchMock.mockResolvedValue(
      authResponse({ id: "u1", email: "dan@example.com" })
    );
    const { getAuthUser } = await load();
    await expect(getAuthUser("tok")).resolves.toEqual({
      id: "u1",
      email: "dan@example.com",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.test/auth/v1/user",
      { headers: { apikey: "anon-key", authorization: "Bearer tok" } }
    );
  });

  it.each([[undefined], [null], [""]])(
    "returns email null when Auth returns %j",
    async email => {
      fetchMock.mockResolvedValue(authResponse({ id: "u1", email }));
      const { getAuthUser } = await load();
      await expect(getAuthUser("tok")).resolves.toEqual({
        id: "u1",
        email: null,
      });
    }
  );

  it("throws Not authenticated on a non-OK response", async () => {
    fetchMock.mockResolvedValue(authResponse({}, false));
    const { getAuthUser } = await load();
    await expect(getAuthUser("tok")).rejects.toThrow("Not authenticated");
  });

  it("throws Not authenticated when the response has no id", async () => {
    fetchMock.mockResolvedValue(authResponse({ email: "dan@example.com" }));
    const { getAuthUser } = await load();
    await expect(getAuthUser("tok")).rejects.toThrow("Not authenticated");
  });
});

describe("getUserIdFromJwt", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("still returns just the id string", async () => {
    fetchMock.mockResolvedValue(
      authResponse({ id: "u1", email: "dan@example.com" })
    );
    const { getUserIdFromJwt } = await load();
    await expect(getUserIdFromJwt("tok")).resolves.toBe("u1");
  });

  it("still throws Not authenticated for an invalid token", async () => {
    fetchMock.mockResolvedValue(authResponse({}, false));
    const { getUserIdFromJwt } = await load();
    await expect(getUserIdFromJwt("tok")).rejects.toThrow("Not authenticated");
  });
});
