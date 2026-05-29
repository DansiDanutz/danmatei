/**
 * Round-trip + tamper + expiry tests for the lead-link signing helper.
 *
 * Why this matters: `signToken` mints the HMAC the parent's "speak to the
 * agent" link is signed with. If verifyToken ever accepts a forged or
 * expired token, anyone who guesses (or scrapes) a lead id can drop into
 * the LiveKit room and impersonate a parent.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { signToken, verifyToken } from "../../api/_lib/sign-token";

const LEAD_ID = "11111111-2222-3333-4444-555555555555";

describe("sign-token", () => {
  beforeEach(() => {
    vi.stubEnv("LEAD_LINK_SIGNING_SECRET", "test-secret-please-rotate");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("signToken returns a string of `${payloadB64}.${sigB64}` shape", () => {
    const token = signToken(LEAD_ID);
    expect(typeof token).toBe("string");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
    // base64url chars only — letters, digits, '-', '_'.
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("verifyToken(signToken(leadId)) returns the same leadId", () => {
    const token = signToken(LEAD_ID);
    expect(verifyToken(token)).toEqual({ leadId: LEAD_ID });
  });

  it("verifyToken rejects a token whose signature was tampered with", () => {
    const token = signToken(LEAD_ID);
    // Flip the last char of the signature half. Must still be a valid
    // base64url char, otherwise we'd be testing parser behavior not HMAC.
    const last = token.slice(-1);
    const replacement = last === "A" ? "B" : "A";
    const tampered = token.slice(0, -1) + replacement;
    expect(tampered).not.toBe(token);
    expect(verifyToken(tampered)).toBeNull();
  });

  it("verifyToken rejects a token whose payload was tampered with", () => {
    const token = signToken(LEAD_ID);
    const [payloadB64, sig] = token.split(".");
    // Bump a char in the payload — signature won't match anymore.
    const last = payloadB64.slice(-1);
    const replacement = last === "a" ? "b" : "a";
    const tampered = payloadB64.slice(0, -1) + replacement + "." + sig;
    expect(verifyToken(tampered)).toBeNull();
  });

  it("verifyToken rejects a token that already expired", () => {
    // expiresAt deliberately set in the past — verifyToken compares against
    // Date.now(), so this should fail without us needing fake timers.
    const expired = signToken(LEAD_ID, { expiresAt: Date.now() - 1000 });
    expect(verifyToken(expired)).toBeNull();
  });

  it("verifyToken accepts a token whose expiry has not yet passed", () => {
    const fresh = signToken(LEAD_ID, { expiresAt: Date.now() + 60_000 });
    expect(verifyToken(fresh)).toEqual({ leadId: LEAD_ID });
  });

  it("verifyToken rejects garbage that doesn't even split into two parts", () => {
    expect(verifyToken("")).toBeNull();
    expect(verifyToken("only-one-part")).toBeNull();
  });
});
