/**
 * GET /api/cron/reap-stale-calls — fires every 15 minutes from Vercel Cron
 * (configured in vercel.json: "*\/15 * * * *").
 *
 * Why: if the Pipecat voice-agent crashes mid-call (OOM, container restart,
 * etc.), no end-of-call webhook ever fires, so the lead's `status` stays at
 * `'calling'` forever. Trainers sit waiting for a transcript that will never
 * arrive. This janitor flips any lead stuck in `'calling'` longer than
 * STUCK_THRESHOLD_MIN to `'failed'` and drops an in-app notification on the
 * assigned trainer so the dead lead surfaces in their inbox.
 *
 * Auth: Vercel Cron sets Authorization: Bearer ${CRON_SECRET}. Same
 * fail-closed posture as cron/daily and cron/weekly-digest.
 */
import { serviceClient } from "../_lib/supabase.js";

const STUCK_THRESHOLD_MIN = 10;

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

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  // Cron auth — fail-closed (matches cron/daily.ts pattern).
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.VERCEL_ENV === "preview"
    ) {
      return res.status(503).json({ error: "cron_secret_unset" });
    }
    console.warn(
      "[cron/reap-stale-calls] CRON_SECRET unset — allowing in dev only",
    );
  } else {
    const auth = readHeader(req, "authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const ranAt = new Date().toISOString();
  const cutoffIso = new Date(
    Date.now() - STUCK_THRESHOLD_MIN * 60_000,
  ).toISOString();

  let sc;
  try {
    sc = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Find stuck leads — anything in 'calling' older than the threshold.
  const { data: stuck, error: findErr } = await sc
    .from("leads")
    .select("id, parent_name, assigned_trainer_id")
    .eq("status", "calling")
    .lt("created_at", cutoffIso);
  if (findErr) {
    return res.status(500).json({ error: findErr.message });
  }
  const ids = (stuck ?? []).map((l) => l.id as string);
  if (ids.length === 0) {
    return res.status(200).json({ ok: true, ranAt, reaped: 0 });
  }

  // Flip to failed.
  const { error: updateErr } = await sc
    .from("leads")
    .update({ status: "failed" })
    .in("id", ids);
  if (updateErr) {
    return res.status(500).json({ error: updateErr.message });
  }

  // Notify the assigned trainer via the existing lead_notifications outbox
  // (inapp channel). Skipped silently for leads with no assigned trainer.
  // lead_notifications has no lead_id column — embed it in payload so the
  // client can deep-link back to the dead lead.
  const notifRows = (stuck ?? []).flatMap((l) =>
    l.assigned_trainer_id
      ? [
          {
            recipient_trainer_id: l.assigned_trainer_id,
            channel: "inapp",
            type: "lead_failed",
            payload: {
              kind: "lead_failed",
              leadId: l.id,
              reason: "agent_no_join",
              parent_name: l.parent_name,
            },
          },
        ]
      : [],
  );
  if (notifRows.length) {
    await sc.from("lead_notifications").insert(notifRows);
  }

  return res
    .status(200)
    .json({ ok: true, ranAt, reaped: ids.length, ids });
}
