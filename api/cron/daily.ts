/**
 * GET /api/cron/daily — fires once a day from Vercel Cron (configured in
 * vercel.json: "0 5 * * *" → 05:00 UTC = 07:00/08:00 Europe/Bucharest).
 *
 * Today's job: find every active child whose birthday is today (Romania
 * time) and fan out a celebratory notification to their parent + trainer
 * (in-app row + Web Push). Parents get the cake banner + confetti as soon
 * as they open the app; the push is a nice bonus that wakes them with a
 * "La mulți ani" reminder.
 *
 * Auth: Vercel Cron sets Authorization: Bearer ${CRON_SECRET}. Requests
 * without the right secret get 401 so curious crawlers can't spam the
 * notify pipeline.
 *
 * Output: { ok, ranAt, birthdays: <count>, notified: <recipients> } so the
 * Vercel logs surface a clean daily summary.
 */
import { serviceClient } from "../_lib/supabase.js";
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

/** Today's MM-DD in Europe/Bucharest. */
function todayMonthDay(): { month: number; day: number; year: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map(p => [p.type, p.value])
  ) as { year: string; month: string; day: string };
  return {
    month: Number(parts.month),
    day: Number(parts.day),
    year: Number(parts.year),
  };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  // Cron auth — Vercel sets the Authorization header automatically.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = readHeader(req, "authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const ranAt = new Date().toISOString();

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  const { month, day, year } = todayMonthDay();

  // Pull all active children with their parent + trainer profile ids in one
  // query, then filter to today's birthdays in JS — there are at most a few
  // hundred kids, so a full table scan is cheap and avoids needing a SQL
  // EXTRACT index. The trade-off is intentional.
  const { data: kids, error } = await supabase
    .from("children")
    .select(
      "id, full_name, dob, parent_id, trainer:trainers!children_trainer_id_fkey(profile_id)"
    )
    .eq("status", "active");
  if (error) {
    return res
      .status(500)
      .json({ error: "fetch_failed", detail: error.message });
  }

  type KidRow = {
    id: string;
    full_name: string;
    dob: string;
    parent_id: string | null;
    trainer: { profile_id?: string } | null;
  };
  const allKids = (kids ?? []) as unknown as KidRow[];

  // Leap-day handling: Feb 29 birthdays celebrate on Mar 1 in non-leap years.
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const todaysBirthdays = allKids.filter(k => {
    if (!k.dob) return false;
    const d = new Date(k.dob);
    let m = d.getUTCMonth() + 1;
    let dy = d.getUTCDate();
    if (m === 2 && dy === 29 && !isLeap) {
      m = 3;
      dy = 1;
    }
    return m === month && dy === day;
  });

  if (todaysBirthdays.length === 0) {
    return res.status(200).json({
      ok: true,
      ranAt,
      birthdays: 0,
      notified: 0,
    });
  }

  // Build per-recipient notification rows + collect unique user ids for push.
  const notificationRows: Array<{
    recipient_id: string;
    kind: string;
    title: string;
    body: string;
    link: string;
  }> = [];
  const pushTargets = new Set<string>();

  for (const k of todaysBirthdays) {
    const firstName = k.full_name.split(/\s+/)[0] ?? k.full_name;
    const ageNow = year - new Date(k.dob).getUTCFullYear();
    const link = `/copil/${k.id}`;
    const title = `La mulți ani, ${firstName}!`;
    const body = `Astăzi ${firstName} împlinește ${ageNow} ani. Trimite-i un mesaj de felicitare.`;

    if (k.parent_id) {
      notificationRows.push({
        recipient_id: k.parent_id,
        kind: "birthday",
        title,
        body,
        link,
      });
      pushTargets.add(k.parent_id);
    }
    if (k.trainer?.profile_id) {
      notificationRows.push({
        recipient_id: k.trainer.profile_id,
        kind: "birthday",
        title,
        body,
        link,
      });
      pushTargets.add(k.trainer.profile_id);
    }
  }

  if (notificationRows.length > 0) {
    const { error: insErr } = await supabase
      .from("notifications")
      .insert(notificationRows);
    if (insErr) {
      console.warn("cron/daily: notification insert failed", insErr.message);
    }
  }

  // Per-recipient push (custom payload per kid would be nicer but a single
  // generic "X happy birthdays today" loses the kid name; we send one push
  // per kid per recipient instead).
  let pushSent = 0;
  let pushSkipped = 0;
  let pushRemoved = 0;
  for (const k of todaysBirthdays) {
    const firstName = k.full_name.split(/\s+/)[0] ?? k.full_name;
    const ageNow = year - new Date(k.dob).getUTCFullYear();
    const recipients: string[] = [];
    if (k.parent_id) recipients.push(k.parent_id);
    if (k.trainer?.profile_id) recipients.push(k.trainer.profile_id);
    if (recipients.length === 0) continue;
    const summary = await sendPushToUsers(recipients, {
      title: `La mulți ani, ${firstName}!`,
      body: `Astăzi ${firstName} împlinește ${ageNow} ani.`,
      tag: `birthday-${k.id}-${year}`,
      url: `/copil/${k.id}`,
    });
    pushSent += summary.sent;
    pushSkipped += summary.skipped;
    pushRemoved += summary.removed;
  }

  return res.status(200).json({
    ok: true,
    ranAt,
    birthdays: todaysBirthdays.length,
    notified: notificationRows.length,
    push: { sent: pushSent, skipped: pushSkipped, removed: pushRemoved },
  });
}
