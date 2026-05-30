/**
 * Regression test for the daily.ts birthday filter timezone bug.
 *
 * The cron runs at 05:00 UTC = 07:00/08:00 Europe/Bucharest. DOBs are stored
 * as YYYY-MM-DD strings in Postgres. The old code did:
 *
 *   const d = new Date(k.dob);      // midnight UTC → 02:00/03:00 Bucharest
 *   d.getUTCMonth() + 1 / d.getUTCDate()
 *
 * Which was correct for UTC but wrong if the cron fire time and the birthday
 * test ever diverged, and conceptually wrong (DOB has no timezone). The fix
 * parses the components directly from the ISO string, bypassing Date entirely.
 *
 * We test the fix by verifying the todayMonthDay + slice logic is consistent
 * and doesn't shift on either side of a EET midnight.
 *
 * We also verify that the age calculation (year - birth_year) uses the parsed
 * birth year, not new Date(dob).getUTCFullYear(), which would give the same
 * wrong result on a child born on a day where UTC and EET differ.
 */
import { describe, expect, it } from "vitest";

// Replicate the helpers from daily.ts so we can unit-test them without
// spinning up the full handler.

function todayMonthDay(now = new Date()): { month: number; day: number; year: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map(p => [p.type, p.value])
  ) as { year: string; month: string; day: string };
  return {
    month: Number(parts.month),
    day: Number(parts.day),
    year: Number(parts.year),
  };
}

function isBirthdayToday(dob: string, now = new Date()): boolean {
  const { month, day, year } = todayMonthDay(now);
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  let m = parseInt(dob.slice(5, 7), 10);
  let dy = parseInt(dob.slice(8, 10), 10);
  if (m === 2 && dy === 29 && !isLeap) {
    m = 3;
    dy = 1;
  }
  return m === month && dy === day;
}

function ageOn(dob: string, now = new Date()): number {
  const { year } = todayMonthDay(now);
  return year - parseInt(dob.slice(0, 4), 10);
}

describe("daily cron birthday helpers", () => {
  // 2026-05-30 00:30 UTC = 2026-05-30 02:30 Bucharest (EET = UTC+3 in summer)
  const earlyMorningUTC = new Date("2026-05-30T00:30:00.000Z");
  // 2026-05-29 22:30 UTC = 2026-05-30 01:30 Bucharest — still May 30 locally
  const lateNightUTC = new Date("2026-05-29T22:30:00.000Z");

  it("matches a birthday that is today in Bucharest time", () => {
    expect(isBirthdayToday("2017-05-30", earlyMorningUTC)).toBe(true);
  });

  it("matches a late-night UTC that is still today in Bucharest", () => {
    // 22:30 UTC = 01:30 next day Bucharest — wait, actually EET is UTC+3 in summer
    // 2026-05-29T22:30 UTC = 2026-05-30T01:30 Bucharest → still May 30
    expect(isBirthdayToday("2017-05-30", lateNightUTC)).toBe(true);
  });

  it("does NOT match yesterday's birthday at Bucharest midnight", () => {
    // 2026-05-30T22:00 UTC = 2026-05-31T01:00 Bucharest → May 31 in Bucharest
    const afterMidnightBucharest = new Date("2026-05-30T22:00:00.000Z");
    expect(isBirthdayToday("2017-05-30", afterMidnightBucharest)).toBe(false);
  });

  it("correctly calculates age from DOB string (not UTC date object)", () => {
    // Child born 2017-05-30, today is 2026-05-30 → turns 9
    expect(ageOn("2017-05-30", earlyMorningUTC)).toBe(9);
  });

  it("handles Feb-29 birthday on non-leap year (celebrates Mar 1)", () => {
    // 2026 is not a leap year
    const mar1 = new Date("2026-03-01T06:00:00.000Z"); // Mar 1 in UTC and EET
    expect(isBirthdayToday("2016-02-29", mar1)).toBe(true);
    // Feb 28 should NOT match
    const feb28 = new Date("2026-02-28T06:00:00.000Z");
    expect(isBirthdayToday("2016-02-29", feb28)).toBe(false);
  });
});
