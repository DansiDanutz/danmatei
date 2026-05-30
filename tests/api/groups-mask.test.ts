/**
 * Unit tests for maskName — the masking /api/groups applies before listing
 * children of the academy on the PUBLIC marketing page (/cunoaste).
 *
 * Why this matters: these are minors shown publicly. If maskName ever emits a
 * full surname, that's a privacy breach. The rule is "First L." — first name
 * plus the last token's initial only.
 */
import { describe, it, expect } from "vitest";
import { maskName } from "../../api/groups";

describe("maskName", () => {
  it("keeps the first name and only the last initial", () => {
    expect(maskName("Andrei Mureșan")).toBe("Andrei M.");
  });
  it("masks the LAST token for 3+ part names (never a full surname)", () => {
    expect(maskName("Andrei Paul Mureșan")).toBe("Andrei M.");
  });
  it("returns a single name unchanged (no surname to mask)", () => {
    expect(maskName("Andrei")).toBe("Andrei");
  });
  it("collapses surrounding/inner whitespace", () => {
    expect(maskName("  Andrei   Mureșan  ")).toBe("Andrei M.");
  });
  it("uppercases the surname initial even from lowercase input", () => {
    expect(maskName("andrei mureșan")).toBe("andrei M.");
  });
  it("handles empty / whitespace-only input without throwing", () => {
    expect(maskName("")).toBe("");
    expect(maskName("   ")).toBe("");
  });
  it("never leaks the full surname token", () => {
    const masked = maskName("Ioana Popescu");
    expect(masked).toBe("Ioana P.");
    expect(masked).not.toContain("Popescu");
  });
});
