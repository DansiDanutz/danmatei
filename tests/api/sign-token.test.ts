/**
 * Unit tests for verifyToken (api/_lib/sign-token).
 *
 * Why this matters: verifyToken used to call resolveSecret() unguarded, so in
 * production with LEAD_LINK_SIGNING_SECRET unset it threw instead of returning
 * null — callers like the ElevenLabs post-call webhook got an unhandled error
 * instead of a rejected token. It must fail CLOSED (null).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { signToken, verifyToken } from "../../api/_lib/sign-token";
import { toLeadCallResult } from "../../api/voice/elevenlabs-webhook";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";

describe("verifyToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("round-trips a token signed with the configured secret", () => {
    vi.stubEnv("LEAD_LINK_SIGNING_SECRET", "s3cret");
    expect(verifyToken(signToken(LEAD_ID))).toEqual({ leadId: LEAD_ID });
  });

  it("returns null (does not throw) in production with no secret", () => {
    vi.stubEnv("LEAD_LINK_SIGNING_SECRET", "s3cret");
    const token = signToken(LEAD_ID);
    vi.stubEnv("LEAD_LINK_SIGNING_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => verifyToken(token)).not.toThrow();
    expect(verifyToken(token)).toBeNull();
  });

  it("makes the webhook treat the call as unknown when the secret is unset in production", () => {
    vi.stubEnv("LEAD_LINK_SIGNING_SECRET", "s3cret");
    const token = signToken(LEAD_ID);
    vi.stubEnv("LEAD_LINK_SIGNING_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "production");
    const payload = {
      type: "post_call_transcription",
      data: {
        conversation_id: "conv-1",
        transcript: [],
        conversation_initiation_client_data: {
          dynamic_variables: { call_token: token },
        },
      },
    } as unknown as Parameters<typeof toLeadCallResult>[0];
    expect(toLeadCallResult(payload)).toBeNull();
  });
});
