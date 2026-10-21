/**
 * /campionat shows per-group totals, so it must read the complete match
 * history (no silent truncation past one response) and count every scored
 * match.
 */
import { describe, expect, it } from "vitest";
import { fetchAllPages } from "../../client/src/lib/fetch-all-pages";
import {
  buildChampionshipGroups,
  type ChampionshipRow,
} from "../../client/src/lib/championship";

const pager = (total: number, failAtFrom?: number) => {
  const calls: [number, number][] = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    if (from === failAtFrom) return { data: null, error: { message: "boom" } };
    const end = Math.min(to + 1, total);
    const data = Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i);
    return { data, error: null };
  };
  return { calls, fetchPage };
};

describe("fetchAllPages", () => {
  it("reads past the per-response cap until a short page", async () => {
    const { calls, fetchPage } = pager(2500);
    const { data, error } = await fetchAllPages(fetchPage, 1000);
    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(data[2499]).toBe(2499);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("asks once more when the total is an exact multiple of the page size", async () => {
    const { calls, fetchPage } = pager(2000);
    const { data, error } = await fetchAllPages(fetchPage, 1000);
    expect(error).toBeNull();
    expect(data).toHaveLength(2000);
    expect(calls).toHaveLength(3);
  });

  it("handles an empty result", async () => {
    const { data, error } = await fetchAllPages(pager(0).fetchPage, 1000);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("stops and reports an error from a later page", async () => {
    const { calls, fetchPage } = pager(2500, 1000);
    const { data, error } = await fetchAllPages(fetchPage, 1000);
    expect(error).toEqual({ message: "boom" });
    expect(data).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });
});

const row = (over: Partial<ChampionshipRow>): ChampionshipRow => ({
  id: "m",
  trainer_id: "t1",
  title: "Etapa",
  starts_at: "2026-06-01T10:00:00Z",
  location: null,
  opponent: null,
  our_score: null,
  opponent_score: null,
  recap_md: null,
  ...over,
});

const seeds = [
  { trainerId: "t1", trainerName: "A", ageMin: 8, ageMax: 11 },
  { trainerId: "t2", trainerName: "B", ageMin: 5, ageMax: 8 },
];

describe("buildChampionshipGroups", () => {
  it("assigns matches to their group, newest first", () => {
    const groups = buildChampionshipGroups(seeds, [
      row({ id: "old", starts_at: "2026-01-01T00:00:00Z" }),
      row({ id: "new", starts_at: "2026-06-01T00:00:00Z" }),
      row({ id: "other", trainer_id: "t2" }),
    ]);
    expect(groups[0].matches.map((m) => m.event_id)).toEqual(["new", "old"]);
    expect(groups[1].matches.map((m) => m.event_id)).toEqual(["other"]);
  });

  it("counts every scored match in W-D-L and goals, and skips unscored ones", () => {
    const [g] = buildChampionshipGroups(seeds, [
      row({ id: "w", our_score: 3, opponent_score: 1 }),
      row({ id: "d", our_score: 2, opponent_score: 2 }),
      row({ id: "l", our_score: 0, opponent_score: 4 }),
      row({ id: "scheduled" }),
    ]);
    expect([g.w, g.d, g.l, g.gf, g.ga]).toEqual([1, 1, 1, 5, 7]);
    expect(g.matches).toHaveLength(4);
  });

  it("keeps scores for the oldest match in a long history", () => {
    const rows = Array.from({ length: 600 }, (_, i) =>
      row({
        id: `m${i}`,
        starts_at: new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
        our_score: 1,
        opponent_score: 0,
      })
    );
    const [g] = buildChampionshipGroups(seeds, rows);
    expect(g.matches).toHaveLength(600);
    expect(g.w).toBe(600);
    expect(g.matches.at(-1)?.event_id).toBe("m0");
    expect(g.matches.at(-1)?.our_score).toBe(1);
  });

  it("ignores matches without a group", () => {
    const groups = buildChampionshipGroups(seeds, [row({ trainer_id: null })]);
    expect(groups.every((g) => g.matches.length === 0)).toBe(true);
  });
});
