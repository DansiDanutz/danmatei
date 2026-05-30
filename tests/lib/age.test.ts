import { describe, expect, it } from "vitest";

import { currentAge, isBirthdayToday } from "../../client/src/lib/age";
import { birthYearFromDob } from "../../shared/date";

describe("age helpers", () => {
  it("uses the academy timezone for birthday boundaries", () => {
    expect(
      isBirthdayToday("2017-05-30", new Date("2026-05-29T22:30:00.000Z"))
    ).toBe(true);
    expect(
      isBirthdayToday("2017-05-30", new Date("2026-05-30T21:30:00.000Z"))
    ).toBe(false);
  });

  it("calculates age from the Bucharest calendar day", () => {
    expect(currentAge("2017-05-30", new Date("2026-05-29T20:30:00.000Z"))).toBe(
      8
    );
    expect(currentAge("2017-05-30", new Date("2026-05-29T22:30:00.000Z"))).toBe(
      9
    );
  });

  it("extracts birth years from DOB strings without timezone conversion", () => {
    expect(birthYearFromDob("2017-01-01")).toBe(2017);
    expect(birthYearFromDob("2017-12-31")).toBe(2017);
  });

  it("celebrates leap-day birthdays on March 1 in non-leap years", () => {
    expect(
      isBirthdayToday("2016-02-29", new Date("2026-02-28T22:30:00.000Z"))
    ).toBe(true);
  });
});
