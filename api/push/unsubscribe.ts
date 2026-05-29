/**
 * POST /api/push/unsubscribe — drop the caller's PushSubscription so they
 * stop receiving background notifications on this browser.
 *
 * Body: { endpoint }
 *
 * Auth: bearer token. We use the service-role client so we can DELETE the
 * row even if the browser already revoked the subscription on its side
 * (RLS allows the user to delete their own row anyway).
 */
import { z } from "zod";
import {
  serviceClient,
  getJwtFromHeader,
  getUserIdFromJwt,
} from "../_lib/supabase.js";

const Body = z.object({
  endpoint: z.string().url().max(2048),
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

  const svc = serviceClient();
  // Scope the delete to the caller — defense in depth on top of RLS.
  const { error } = await svc
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint)
    .eq("user_id", userId);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
