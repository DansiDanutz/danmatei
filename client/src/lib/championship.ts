/**
 * Per-group match history and W-D-L / goal totals for /campionat, built from
 * the complete public_championship() rows (migration 0038).
 */
export interface ChampionshipRow {
  id: string;
  trainer_id: string | null;
  title: string;
  starts_at: string;
  location: string | null;
  opponent: string | null;
  our_score: number | null;
  opponent_score: number | null;
  recap_md: string | null;
}

export interface GroupSeed {
  trainerId: string;
  trainerName: string;
  ageMin: number;
  ageMax: number;
}

export interface MatchRow {
  event_id: string;
  title: string;
  starts_at: string;
  location: string | null;
  opponent: string | null;
  our_score: number | null;
  opponent_score: number | null;
  recap_md: string | null;
}

export interface GroupBlock extends GroupSeed {
  matches: MatchRow[];
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

/** Matches newest first; only scored matches count toward the totals. */
export function buildChampionshipGroups(
  seeds: GroupSeed[],
  rows: ChampionshipRow[]
): GroupBlock[] {
  const sorted = [...rows].sort((a, b) =>
    b.starts_at.localeCompare(a.starts_at)
  );
  return seeds.map((s) => {
    const matches: MatchRow[] = sorted
      .filter((r) => r.trainer_id === s.trainerId)
      .map((r) => ({
        event_id: r.id,
        title: r.title,
        starts_at: r.starts_at,
        location: r.location,
        opponent: r.opponent,
        our_score: r.our_score,
        opponent_score: r.opponent_score,
        recap_md: r.recap_md,
      }));
    let w = 0;
    let d = 0;
    let l = 0;
    let gf = 0;
    let ga = 0;
    for (const m of matches) {
      if (m.our_score == null || m.opponent_score == null) continue;
      gf += m.our_score;
      ga += m.opponent_score;
      if (m.our_score > m.opponent_score) w++;
      else if (m.our_score === m.opponent_score) d++;
      else l++;
    }
    return { ...s, matches, w, d, l, gf, ga };
  });
}
