import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configuredPublicBaseUrl,
  publicBaseUrlFromHeaders,
} from "../../api/_lib/public-url";

describe("public URL helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the canonical custom domain when no app URL env is configured", () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    vi.stubEnv("VITE_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    expect(configuredPublicBaseUrl()).toBe("https://www.danmatei.ro");
  });

  it("normalizes configured app origins and strips paths", () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://www.danmatei.ro/programare/");

    expect(configuredPublicBaseUrl()).toBe("https://www.danmatei.ro");
    expect(publicBaseUrlFromHeaders({ host: "evil.example" })).toBe(
      "https://www.danmatei.ro"
    );
  });

  it("ignores host headers in production when PUBLIC_BASE_URL is missing", () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    vi.stubEnv("VITE_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(publicBaseUrlFromHeaders({ host: "attacker.example" })).toBe(
      "https://www.danmatei.ro"
    );
  });

  it("can infer localhost during local development", () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    vi.stubEnv("VITE_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "development");

    expect(
      publicBaseUrlFromHeaders({
        host: "127.0.0.1:3030",
        "x-forwarded-proto": "http",
      })
    ).toBe("http://127.0.0.1:3030");
  });
});
