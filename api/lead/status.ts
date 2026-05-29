/**
 * POST /api/lead/status
 *
 * Trainer mutates one or many leads at once:
 *   - status: routed / contacted / closed
 *   - snoozedUntil: null (un-snooze) or ISO timestamp (snooze for N hours)
 *
 * Body shapes (id form preserved for backwards compatibility):
 *   { id: uuid, status?, snoozedUntil?, note? }
 *   { ids: uuid[], status?, snoozedUntil?, note? }
 *
 * At least one of `status` and `snoozedUntil` must be present. `note` is
 * single-lead only — appending it to multiple unrelated calls would be
 * confusing.
 *
 * Authorization is enforced per lead with the same rule as the original
 * single-lead endpoint: caller must be the assigned trainer slug, in
 * cc_trainer_ids, or owner/super_admin. Mixed batches return per-id results
 * so the client can show partial success without a 4xx blocking the rest.
 */
import { z } from "zod";
import { serviceClient } from "../_lib/supabase.js";

const Body = z
  .object({
    id: z.string().uuid().optional(),
    ids: z.array(z.string().uuid()).min(1).max(100).optional(),
    status: z.enum(["routed", "contacted", "closed"]).optional(),
    snoozedUntil: z.string().datetime().nullable().optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .refine(d => d.id || (d.ids && d.ids.length > 0), {
    message: "Provide id or ids",
  })
  .refine(d => d.status !== undefined || d.snoozedUntil !== undefined, {
    message: "Provide status or snoozedUntil",
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
  const { id, ids, status, snoozedUntil, note } = parsed.data;
  const targetIds = ids ?? (id ? [id] : []);
  const isBulk = targetIds.length > 1;

  if (isBulk && note) {
    return res.status(400).json({
      error: "note_single_only",
      message: "Notes can only be attached to a single lead at a time.",
    });
  }

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

  // Fetch all targeted leads in one query and authorize per-row.
  const { data: leads, error: leadErr } = await supabase
    .from("leads")
    .select("id, assigned_trainer_id, cc_trainer_ids")
    .in("id", targetIds);
  if (leadErr) {
    return res.status(500).json({ error: "fetch_failed", detail: leadErr.message });
  }

  const isAdmin = prof.role === "owner" || prof.role === "super_admin";
  const allowed: string[] = [];
  const denied: string[] = [];
  for (const lead of leads ?? []) {
    const ok =
      isAdmin ||
      (trainerSlug != null &&
        (lead.assigned_trainer_id === trainerSlug ||
          (lead.cc_trainer_ids ?? []).includes(trainerSlug)));
    if (ok) allowed.push(lead.id as string);
    else denied.push(lead.id as string);
  }

  // Single-id legacy callers expect 403/404 — preserve that behavior.
  if (!isBulk) {
    if ((leads ?? []).length === 0) {
      return res.status(404).json({ error: "lead_not_found" });
    }
    if (allowed.length === 0) {
      return res.status(403).json({ error: "forbidden" });
    }
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (status !== undefined) update.status = status;
  if (snoozedUntil !== undefined) update.snoozed_until = snoozedUntil;

  // Optional note: only allowed in the single-lead path.
  if (note && !isBulk && allowed[0]) {
    const { data: latestCall } = await supabase
      .from("lead_calls")
      .select("id, summary")
      .eq("lead_id", allowed[0])
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

  if (allowed.length > 0) {
    const { error: upErr } = await supabase
      .from("leads")
      .update(update)
      .in("id", allowed);
    if (upErr) {
      return res
        .status(500)
        .json({ error: "update_failed", detail: upErr.message });
    }
  }

  return res.status(200).json({
    ok: true,
    updated: allowed,
    denied,
    status: status ?? null,
    snoozedUntil: snoozedUntil ?? null,
    // Back-compat for legacy single-id callers that read `leadId`/`status`.
    leadId: !isBulk ? id : undefined,
  });
}
