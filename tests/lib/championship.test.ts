/**
 * /campionat shows per-group totals built from the complete match history,
 * so every scored match must be counted in its own group.
 */
import { describe, expect, it } from "vitest";
import {
  buildChampionshipGroups,
  type ChampionshipRow,
} from "../../client/src/lib/championship";

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
