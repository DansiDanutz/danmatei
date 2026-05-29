/**
 * POST /api/push/subscribe — register the caller's PushSubscription so the
 * server can fan out background notifications to it.
 *
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? }
 *
 * Idempotent: identical endpoints upsert (the browser may resubscribe and
 * we don't want a duplicate row each time). The endpoint URL is the unique
 * identifier — keys can rotate.
 *
 * Auth: bearer token of the user who owns the subscription. RLS on
 * push_subscriptions enforces user_id = auth.uid() on insert too, but we
 * use the service-role client here so we can do a clean ON CONFLICT upsert
 * keyed on `endpoint` (parents may share a family device).
 */
import { z } from "zod";
import {
  serviceClient,
  getJwtFromHeader,
  getUserIdFromJwt,
} from "../_lib/supabase.js";

const Body = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(10).max(512),
    auth: z.string().min(10).max(512),
  }),
  userAgent: z.string().max(500).optional().nullable(),
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

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader =
    (typeof req.headers?.authorization === "string"
      ? req.headers.authorization
      : Array.isArray(req.headers?.authorization)
        ? req.headers.authorization[0]
        : undefined) ?? "";
  const jwt = getJwtFromHeader(authHeader);
  if (!jwt) return res.status(401).json({ error: "Missing bearer token" });

  let userId: string;
  try {
    userId = await getUserIdFromJwt(jwt);
  } catch (e) {
    return res.status(401).json({ error: (e as Error).message });
  }

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const v = parsed.data;

  // Endpoint is unique table-wide. Before inserting/updating we look it up
  // to make sure it doesn't already belong to a DIFFERENT user — otherwise
  // a known endpoint URL could be reassigned and notifications hijacked.
  const svc = serviceClient();

  const existing = await svc
    .from("push_subscriptions")
    .select("user_id")
    .eq("endpoint", v.endpoint)
    .maybeSingle();

  if (existing.error) {
    return res.status(500).json({ error: existing.error.message });
  }

  if (existing.data && existing.data.user_id !== userId) {
    return res.status(409).json({ error: "endpoint_owned_by_another_user" });
  }

  if (existing.data) {
    const { error } = await svc
      .from("push_subscriptions")
      .update({
        p256dh: v.keys.p256dh,
        auth: v.keys.auth,
        user_agent: v.userAgent ?? null,
        last_used_at: new Date().toISOString(),
      })
      .eq("endpoint", v.endpoint)
      .eq("user_id", userId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
  } else {
    const { error } = await svc.from("push_subscriptions").insert({
      user_id: userId,
      endpoint: v.endpoint,
      p256dh: v.keys.p256dh,
      auth: v.keys.auth,
      user_agent: v.userAgent ?? null,
      last_used_at: new Date().toISOString(),
    });
    if (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(200).json({ ok: true });
}
