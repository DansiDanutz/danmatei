/**
 * GET /api/cron/schedule-reminder — weekly nudge (Vercel Cron).
 *
 * For every active trainer, checks whether they have at least one non-cancelled
 * TRAINING in the next 7 days. If not, it notifies the trainer AND the
 * owner/admins ("Nu ai program pentru săptămâna viitoare") via in-app row +
 * Web Push, so the schedule never silently lapses.
 *
 * Auth: Vercel Cron sets Authorization: Bearer ${CRON_SECRET}. When CRON_SECRET
 * is set, mismatched requests get 401.
 */
import { serviceClient } from "../_lib/supabase.js";
import { requireCron } from "../_lib/cron-auth.js";
import { sendPushToUsers } from "../_lib/push.js";

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!requireCron(req, res, "cron/schedule-reminder")) return;

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [{ data: trainers }, { data: events }, { data: owners }] =
    await Promise.all([
      supabase
        .from("trainers")
        .select(
          "id, profile_id, profile:profiles!trainers_profile_id_fkey(full_name)"
        )
        .eq("active", true),
      supabase
        .from("schedule_events")
        .select("trainer_id")
        .eq("kind", "training")
        .is("cancelled_at", null)
        .gte("starts_at", now.toISOString())
        .lte("starts_at", in7.toISOString()),
      supabase
        .from("profiles")
        .select("id")
        .in("role", ["owner", "super_admin"]),
    ]);

  const trainersWithUpcoming = new Set(
    ((events ?? []) as { trainer_id: string | null }[])
      .map(e => e.trainer_id)
      .filter(Boolean) as string[]
  );
  const ownerIds = ((owners ?? []) as { id: string }[]).map(o => o.id);

  const missing = (
    (trainers ?? []) as unknown as Array<{
      id: string;
      profile_id: string | null;
      profile: { full_name: string } | null;
    }>
  ).filter(t => !trainersWithUpcoming.has(t.id));

  let notifiedTrainers = 0;
  for (const t of missing) {
    const trainerName = t.profile?.full_name ?? "Antrenor";
    // Trainer gets a direct reminder; owners get a heads-up per trainer.
    const trainerRecipients = t.profile_id ? [t.profile_id] : [];
    const recipients = Array.from(new Set([...trainerRecipients, ...ownerIds]));
    if (recipients.length === 0) continue;

    const title = "Program lipsă pentru săptămâna viitoare";
    const body = `${trainerName} nu are niciun antrenament programat în următoarele 7 zile.`;
    const link = "/antrenor";

    const rows = recipients.map(rid => ({
      recipient_id: rid,
      kind: "schedule_missing",
      title,
      body,
      link,
    }));
    await supabase.from("notifications").insert(rows);
    await sendPushToUsers(recipients, {
      title,
      body,
      tag: `sched-missing-${t.id}`,
      url: link,
    });
    notifiedTrainers += 1;
  }

  return res.status(200).json({
    ok: true,
    ranAt: now.toISOString(),
    trainersChecked: (trainers ?? []).length,
    trainersMissingSchedule: notifiedTrainers,
  });
}
