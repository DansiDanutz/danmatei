/**
 * The set-new-password form schema of the mobile app, which does not need React
 * Native. The screen and `authService` are covered by the mobile typecheck.
 */
import { describe, expect, it } from "vitest";

import { hasRecoveryLinkError } from "../apps/mobile/src/features/auth/recovery-url";
import { resetPasswordSchema } from "../apps/mobile/src/features/auth/schemas";

describe("resetPasswordSchema", () => {
  it("accepts two matching passwords of at least 8 characters", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "parola-noua-1",
        confirmPassword: "parola-noua-1",
      }).success
    ).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const r = resetPasswordSchema.safeParse({
      password: "scurt",
      confirmPassword: "scurt",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        "Parola trebuie să aibă cel puțin 8 caractere"
      );
    }
  });

  it("reports a mismatch on confirmPassword", () => {
    const r = resetPasswordSchema.safeParse({
      password: "parola-noua-1",
      confirmPassword: "parola-noua-2",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(["confirmPassword"]);
      expect(r.error.issues[0].message).toBe("Parolele nu coincid");
    }
  });
});

describe("hasRecoveryLinkError", () => {
  it("detects an error in the hash", () => {
    expect(
      hasRecoveryLinkError("#error=access_denied&error_code=otp_expired", "")
    ).toBe(true);
  });

  it("detects an error in the query", () => {
    expect(hasRecoveryLinkError("", "?error=access_denied")).toBe(true);
  });

  it("ignores a valid recovery link", () => {
    expect(hasRecoveryLinkError("#access_token=abc&type=recovery", "")).toBe(
      false
    );
  });
});
