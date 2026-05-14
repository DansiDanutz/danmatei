/**
 * POST /api/lead/status
 *
 * Trainer marks a lead as contacted / closed (or back to routed for
 * "needs attention").
 *
 * Body: { id: string, status: "routed" | "contacted" | "closed" }
 *
 * The endpoint uses the service-role client to write, but enforces
 * authorization itself: the caller must present a Bearer JWT and
 * must be the `assigned_trainer_id` for the lead OR be in
 * `cc_trainer_ids` OR be an owner / super_admin.
 *
 * The trainer slug is derived from the user's `fotbal.trainers` row
 * (or `t-dan` for owner). Mirrors the routing rules in api/lead/create.ts.
 */
import { z } from "zod";
import { serviceClient } from "../_lib/supabase.js";

const Body = z.object({
  id: z.string().uuid(),
  status: z.enum(["routed", "contacted", "closed"]),
  note: z.string().trim().max(2000).optional(),
});

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function readBody(req: Req): Record<string, unknown> {
  if (typeof req.body === "object" && req.body) return req.body as Record<string, unknown>;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const auth = readHeader(req, "authorization") ?? "";
  if (!/^bearer\s+/i.test(auth)) {
    return res.status(401).json({ error: "missing_bearer" });
  }
  const jwt = auth.replace(/^bearer\s+/i, "").trim();

  const parsed = Body.safeParse(readBody(req));
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_body",
      issues: parsed.error.issues,
    });
  }
  const { id, status, note } = parsed.data;

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Resolve the caller from the JWT
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "invalid_jwt" });
  }
  const userId = userData.user.id;

  // Fetch caller profile + (optional) trainer row to learn the slug
  const [{ data: prof }, { data: trainer }] = await Promise.all([
    supabase.from("profiles").select("id, role").eq("id", userId).maybeSingle(),
    supabase
      .from("trainers")
      .select("id, age_min, age_max")
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);
  if (!prof) return res.status(401).json({ error: "no_profile" });

  // Map age range → slug (mirrors api/lead/create.ts)
  let trainerSlug: string | null = null;
  if (trainer) {
    const mid = (trainer.age_min + trainer.age_max) / 2;
    trainerSlug = mid <= 9 ? "t-sopi" : mid <= 13 ? "t-kelemen" : "t-dan";
  }
  if (prof.role === "owner" || prof.role === "super_admin") trainerSlug = "t-dan";

  // Fetch the lead and check authorization
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, assigned_trainer_id, cc_trainer_ids")
    .eq("id", id)
    .maybeSingle();
  if (leadErr || !lead) {
    return res.status(404).json({ error: "lead_not_found" });
  }

  const isAssigned =
    trainerSlug != null &&
    (lead.assigned_trainer_id === trainerSlug ||
      (lead.cc_trainer_ids ?? []).includes(trainerSlug));
  const isAdmin = prof.role === "owner" || prof.role === "super_admin";
  if (!isAssigned && !isAdmin) {
    return res.status(403).json({ error: "forbidden" });
  }

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  // If a note was sent, append it to the latest lead_call summary so the
  // trainer's follow-up shows up alongside the AI summary.
  if (note) {
    const { data: latestCall } = await supabase
      .from("lead_calls")
      .select("id, summary")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestCall) {
      const existing = (latestCall.summary as string | null) ?? "";
      const stamp = new Date().toLocaleString("ro-RO");
      const joined = existing
        ? `${existing}\n\n—\n[${stamp} · ${trainerSlug}]\n${note}`
        : note;
      await supabase
        .from("lead_calls")
        .update({ summary: joined })
        .eq("id", latestCall.id);
    }
  }

  const { error: upErr } = await supabase.from("leads").update(update).eq("id", id);
  if (upErr) {
    return res
      .status(500)
      .json({ error: "update_failed", detail: upErr.message });
  }

  return res.status(200).json({ ok: true, leadId: id, status });
}
