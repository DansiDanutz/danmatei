/**
 * Unit tests for the coaching-tip library helpers that target + rotate the
 * daily digest (api/cron/coaching-digest).
 *
 * Why this matters: bandForAge decides WHICH age band a trainer's tip is drawn
 * from — a wrong boundary would send U17 tactics to a U7 coach. pickTip must be
 * deterministic per (band, day) and always in-range, or the cron could throw or
 * silently repeat. tipsForBand guarantees every band has content so the digest
 * is never empty.
 */
import { describe, it, expect } from "vitest";
import {
  bandForAge,
  bandLabel,
  pickTip,
  tipsForBand,
  COACHING_TIPS,
  type AgeBand,
} from "../../api/_lib/coaching-tips";

const BANDS: AgeBand[] = ["U5-U8", "U9-U12", "U13-U15", "U16-U19", "owner"];

describe("bandForAge", () => {
  it("maps age midpoints to the right band", () => {
    expect(bandForAge(5, 6)).toBe("U5-U8");
    expect(bandForAge(8, 8)).toBe("U5-U8"); // midpoint 8 is inclusive
    expect(bandForAge(8, 11)).toBe("U9-U12"); // midpoint 9.5
    expect(bandForAge(9, 12)).toBe("U9-U12");
    expect(bandForAge(13, 15)).toBe("U13-U15");
    expect(bandForAge(16, 19)).toBe("U16-U19");
    expect(bandForAge(18, 19)).toBe("U16-U19");
  });
  it("defaults to U9-U12 when ages are unknown", () => {
    expect(bandForAge(null, null)).toBe("U9-U12");
    expect(bandForAge(undefined, undefined)).toBe("U9-U12");
  });
  it("uses the single provided bound when only one is set", () => {
    expect(bandForAge(7, null)).toBe("U5-U8");
    expect(bandForAge(null, 14)).toBe("U13-U15");
  });
});

describe("bandLabel", () => {
  it("returns a non-empty label for every band", () => {
    for (const b of BANDS) expect(bandLabel(b).length).toBeGreaterThan(0);
  });
});

describe("tipsForBand", () => {
  it("every band has at least 3 tips so rotation isn't trivial", () => {
    for (const b of BANDS)
      expect(tipsForBand(b).length).toBeGreaterThanOrEqual(3);
  });
  it("every tip in a band actually lists that band", () => {
    for (const b of BANDS)
      for (const t of tipsForBand(b)) expect(t.bands).toContain(b);
  });
});

describe("pickTip", () => {
  it("is deterministic for a given band + day", () => {
    expect(pickTip("U9-U12", 10)).toEqual(pickTip("U9-U12", 10));
  });
  it("always returns a tip belonging to the requested band", () => {
    for (const b of BANDS)
      for (let d = 0; d < 40; d++) expect(pickTip(b, d).bands).toContain(b);
  });
  it("handles negative and very large day indices without throwing", () => {
    for (const b of BANDS) {
      expect(() => pickTip(b, -5)).not.toThrow();
      expect(pickTip(b, -5).bands).toContain(b);
      expect(pickTip(b, 100_000).bands).toContain(b);
    }
  });
  it("rotates: consecutive days differ when the pool has >1 tip", () => {
    expect(tipsForBand("U9-U12").length).toBeGreaterThan(1);
    expect(pickTip("U9-U12", 0).title).not.toBe(pickTip("U9-U12", 1).title);
  });
});

describe("COACHING_TIPS integrity", () => {
  it("no tip has an empty title/body/source/bands", () => {
    for (const t of COACHING_TIPS) {
      expect(t.title.trim().length).toBeGreaterThan(0);
      expect(t.body.trim().length).toBeGreaterThan(0);
      expect(t.source.trim().length).toBeGreaterThan(0);
      expect(t.bands.length).toBeGreaterThan(0);
    }
  });
});
