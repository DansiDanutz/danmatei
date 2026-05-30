/**
 * Unit tests for escapeLike (api/_lib/like).
 *
 * Why this matters: the academy-wide player search interpolates the user's `?q=`
 * into an ILIKE pattern. Unescaped `%`/`_` would act as wildcards — a single
 * `%` would match every minor in the academy. escapeLike must neutralise them.
 */
import { describe, it, expect } from "vitest";
import { escapeLike } from "../../api/_lib/like";

describe("escapeLike", () => {
  it("escapes percent so it can't match everything", () => {
    expect(escapeLike("%")).toBe("\\%");
  });

  it("escapes underscore (single-char wildcard)", () => {
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes backslash first so it can't double-escape", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary names untouched", () => {
    expect(escapeLike("Ionuț Popescu")).toBe("Ionuț Popescu");
  });

  it("handles a mixed injection attempt", () => {
    expect(escapeLike("%_\\")).toBe("\\%\\_\\\\");
  });

  it("returns empty for empty input", () => {
    expect(escapeLike("")).toBe("");
  });
});
