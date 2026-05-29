/**
 * GET /api/cron/weekly-digest — Sunday 17:00 UTC (= 19:00/20:00 Cluj).
 *
 * One push per parent summarizing the week for ALL their kids:
 *   "Săptămâna lui {Andrei}: 3 antrenamente, 1 meci, 5 poze noi.
 *    Prima oră de luni: 18:00."
 *
 * Multi-child parents get a combined digest in a single notification so
 * we don't ping their phone N times back to back.
 *
 * Auth: Bearer ${CRON_SECRET} (Vercel Cron sets this automatically).
 *
 * Output: { ok, ranAt, parents, notified, push } — surfaces in Vercel logs.
 */
import { serviceClient, getJwtFromHeader } from "../_lib/supabase.js";
import { sendPushToUsers } from "../_lib/push.js";

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function startOfNextWeekIso(): string {
  // First day after "today" — used to find next week's first event.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfThisDigestWeekIso(): string {
  // Last 7 days (rolling).
  return new Date(Date.now() - 7 * 86400_000).toISOString();
}

function pluralize(n: number, one: string, few: string, many: string): string {
  // Romanian numerical agreement: 1 → singular, 2-19 → "few", 20+ → "many"
  // (we treat 0 as the singular form too — body uses absolute numbers).
  if (n === 1) return `${n} ${one}`;
  if (n >= 2 && n <= 19) return `${n} ${few}`;
  return `${n} ${many}`;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  // Cron auth — same pattern as the daily cron.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = readHeader(req, "authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      const authProvided = getJwtFromHeader(auth);
      if (!authProvided) return res.status(401).json({ error: "unauthorized" });
    }
  }

  const ranAt = new Date().toISOString();
  const sinceIso = startOfThisDigestWeekIso();
  const nextWeekStartIso = startOfNextWeekIso();

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Pull all active children with parent + trainer.
  const { data: kids, error: kidsErr } = await supabase
    .from("children")
    .select("id, full_name, parent_id, trainer_id")
    .eq("status", "active")
    .not("parent_id", "is", null);
  if (kidsErr) {
    return res
      .status(500)
      .json({ error: "fetch_failed", detail: kidsErr.message });
  }

  type Kid = {
    id: string;
    full_name: string;
    parent_id: string;
    trainer_id: string | null;
  };
  const allKids = (kids ?? []) as Kid[];
  if (allKids.length === 0) {
    return res.status(200).json({
      ok: true,
      ranAt,
      parents: 0,
      notified: 0,
    });
  }

  const kidIds = allKids.map(k => k.id);
  const trainerIds = Array.from(
    new Set(allKids.map(k => k.trainer_id).filter((t): t is string => !!t))
  );

  // Pull this week's data in batched queries.
  const [attRes, mediaRes, schedRes, partRes] = await Promise.all([
    supabase
      .from("attendance")
      .select("child_id, status")
      .in("child_id", kidIds)
      .gte("created_at", sinceIso),
    supabase
      .from("media")
      .select("child_id, kind")
      .in("child_id", kidIds)
      .gte("created_at", sinceIso),
    trainerIds.length > 0
      ? supabase
          .from("schedule_events")
          .select("trainer_id, kind, title, starts_at")
          .in("trainer_id", trainerIds)
          .is("cancelled_at", null)
          .gte("starts_at", nextWeekStartIso)
          .order("starts_at", { ascending: true })
      : Promise.resolve({ data: [], error: null } as const),
    supabase
      .from("match_participations")
      .select("child_id, goals, assists")
      .in("child_id", kidIds)
      .gte("created_at", sinceIso),
  ]);

  type AttRow = { child_id: string; status: string };
  type MediaRow = { child_id: string; kind: "image" | "video" };
  type SchedRow = {
    trainer_id: string;
    kind: string;
    title: string;
    starts_at: string;
  };
  type PartRow = { child_id: string; goals: number; assists: number };

  const attByKid = new Map<string, { present: number; total: number }>();
  for (const a of (attRes.data as AttRow[] | null) ?? []) {
    const cur = attByKid.get(a.child_id) ?? { present: 0, total: 0 };
    cur.total += 1;
    if (a.status === "present") cur.present += 1;
    attByKid.set(a.child_id, cur);
  }

  const mediaByKid = new Map<string, number>();
  for (const m of (mediaRes.data as MediaRow[] | null) ?? []) {
    mediaByKid.set(m.child_id, (mediaByKid.get(m.child_id) ?? 0) + 1);
  }

  const partByKid = new Map<string, { goals: number; assists: number }>();
  for (const p of (partRes.data as PartRow[] | null) ?? []) {
    const cur = partByKid.get(p.child_id) ?? { goals: 0, assists: 0 };
    cur.goals += p.goals;
    cur.assists += p.assists;
    partByKid.set(p.child_id, cur);
  }

  // For each trainer, find the FIRST event of next week.
  const firstNextByTrainer = new Map<
    string,
    { kind: string; title: string; starts_at: string }
  >();
  for (const s of (schedRes.data as SchedRow[] | null) ?? []) {
    if (!firstNextByTrainer.has(s.trainer_id)) {
      firstNextByTrainer.set(s.trainer_id, {
        kind: s.kind,
        title: s.title,
        starts_at: s.starts_at,
      });
    }
  }

  // Group kids by parent so multi-child families get one combined digest.
  const kidsByParent = new Map<string, Kid[]>();
  for (const k of allKids) {
    if (!kidsByParent.has(k.parent_id)) kidsByParent.set(k.parent_id, []);
    kidsByParent.get(k.parent_id)!.push(k);
  }

  let notified = 0;
  let pushSent = 0;
  let pushRemoved = 0;

  for (const [parentId, parentKids] of kidsByParent) {
    // Per-kid mini-summaries.
    const kidLines: string[] = [];
    let parentHadActivity = false;
    let firstNext: {
      kind: string;
      title: string;
      starts_at: string;
    } | null = null;

    for (const kid of parentKids) {
      const att = attByKid.get(kid.id);
      const media = mediaByKid.get(kid.id) ?? 0;
      const part = partByKid.get(kid.id);
      const firstName = kid.full_name.split(/\s+/)[0] ?? kid.full_name;

      const segments: string[] = [];
      if (att && att.present > 0) {
        segments.push(
          pluralize(
            att.present,
            "antrenament",
            "antrenamente",
            "de antrenamente"
          )
        );
      }
      if (part && part.goals > 0) {
        segments.push(pluralize(part.goals, "gol", "goluri", "de goluri"));
      }
      if (part && part.assists > 0) {
        segments.push(
          pluralize(part.assists, "asist", "asisturi", "de asisturi")
        );
      }
      if (media > 0) {
        segments.push(pluralize(media, "poză nouă", "poze noi", "de poze noi"));
      }

      if (segments.length > 0) {
        parentHadActivity = true;
        kidLines.push(`${firstName}: ${segments.join(" · ")}`);
      }

      if (kid.trainer_id) {
        const next = firstNextByTrainer.get(kid.trainer_id);
        if (next && (!firstNext || next.starts_at < firstNext.starts_at)) {
          firstNext = next;
        }
      }
    }

    // Skip parents with no signal — don't ping their phone with "nimic".
    if (!parentHadActivity && !firstNext) continue;

    const lines = [...kidLines];
    if (firstNext) {
      const dateRO = new Date(firstNext.starts_at).toLocaleString("ro-RO", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Bucharest",
      });
      const kindWord =
        firstNext.kind === "match"
          ? "Următorul meci"
          : firstNext.kind === "tournament"
            ? "Următorul turneu"
            : "Următorul antrenament";
      lines.push(`${kindWord}: ${dateRO}`);
    }

    const title =
      parentKids.length > 1
        ? `Săptămâna copiilor tăi`
        : `Săptămâna lui ${parentKids[0].full_name.split(/\s+/)[0]}`;
    const body = lines.join(" · ");
    const link = "/dashboard";

    const { error: nErr } = await supabase.from("notifications").insert({
      recipient_id: parentId,
      kind: "weekly_digest",
      title,
      body,
      link,
    });
    if (nErr) continue;
    notified += 1;

    const ps = await sendPushToUsers([parentId], {
      title,
      body,
      tag: `weekly-digest-${ranAt.slice(0, 10)}`,
      url: link,
    });
    pushSent += ps.sent;
    pushRemoved += ps.removed;
  }

  return res.status(200).json({
    ok: true,
    ranAt,
    parents: kidsByParent.size,
    notified,
    push: { sent: pushSent, removed: pushRemoved },
  });
}
