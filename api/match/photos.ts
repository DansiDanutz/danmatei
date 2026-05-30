/**
 * GET /api/match/photos?eventId=...
 *
 * The per-match photo archive. Returns the match's photos as short-lived signed
 * URLs from the private bucket (the photos are of minors — they never become
 * public), plus whether the caller may still upload (the 24h post-match window).
 *
 * Why service-role: both fotbal.media's read policy and the storage object read
 * policy are uploader/owner-scoped, so a group member can't see another member's
 * photo on their own client. The server checks group membership, then signs.
 *
 * Membership: owner / super_admin · the event's trainer · a parent with a child
 * in the event's group.
 *
 * Auth: bearer JWT.
 */
import { serviceClient, getJwtFromHeader } from "../_lib/supabase.js";

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}
function readQuery(req: Req, key: string): string | undefined {
  const direct = req.query?.[key];
  if (direct != null) return Array.isArray(direct) ? direct[0] : direct;
  if (req.url) {
    const qi = req.url.indexOf("?");
    if (qi >= 0) return new URLSearchParams(req.url.slice(qi)).get(key) ?? undefined;
  }
  return undefined;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "fotbal-media-private";
const SIGN_TTL = 60 * 60 * 4; // 4h
const WINDOW_MS = 24 * 60 * 60 * 1000;

type MediaRow = {
  id: string;
  storage_path: string;
  mime: string | null;
  created_at: string;
  uploader_id: string | null;
};

export default async function handler(req: Req, res: Res) {
  if (req.method && req.method !== "GET")
    return res.status(405).json({ error: "method_not_allowed" });

  const jwt = getJwtFromHeader(readHeader(req, "authorization") ?? "");
  if (!jwt) return res.status(401).json({ error: "missing_bearer" });

  const eventId = readQuery(req, "eventId") ?? "";
  if (!UUID_RE.test(eventId))
    return res.status(400).json({ error: "invalid_event_id" });

  let svc;
  try {
    svc = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  const { data: userData, error: userErr } = await svc.auth.getUser(jwt);
  if (userErr || !userData?.user)
    return res.status(401).json({ error: "invalid_jwt" });
  const userId = userData.user.id;

  const { data: event } = await svc
    .from("schedule_events")
    .select(
      "id, trainer_id, approval_status, finalized_at, trainers:trainer_id (profile_id)"
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return res.status(404).json({ error: "event_not_found" });

  const { data: prof } = await svc
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const isAdmin = prof?.role === "owner" || prof?.role === "super_admin";
  const evTrainer = event.trainers as { profile_id?: string } | null;
  const isTrainer = !!evTrainer?.profile_id && evTrainer.profile_id === userId;

  let isParent = false;
  if (!isAdmin && !isTrainer && event.trainer_id) {
    const { count } = await svc
      .from("children")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", userId)
      .eq("trainer_id", event.trainer_id as string);
    isParent = (count ?? 0) > 0;
  }
  if (!isAdmin && !isTrainer && !isParent)
    return res.status(403).json({ error: "forbidden" });

  const { data: rows } = await svc
    .from("media")
    .select("id, storage_path, mime, created_at, uploader_id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  const media = (rows ?? []) as MediaRow[];

  // Batch-sign the private paths.
  const paths = media.map((m) => m.storage_path);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signedData } = await svc.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGN_TTL);
    for (const s of (signedData ?? []) as Array<{
      path?: string | null;
      signedUrl?: string | null;
    }>) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  const photos = media
    .map((m) => ({
      id: m.id,
      url: signed.get(m.storage_path) ?? null,
      mime: m.mime,
      createdAt: m.created_at,
      mine: m.uploader_id === userId,
    }))
    .filter((p) => p.url);

  const finalizedAt = event.finalized_at as string | null;
  const windowEndsAt = finalizedAt
    ? new Date(new Date(finalizedAt).getTime() + WINDOW_MS).toISOString()
    : null;
  const canUpload =
    event.approval_status === "approved" &&
    !!finalizedAt &&
    Date.now() < new Date(finalizedAt).getTime() + WINDOW_MS;

  return res.status(200).json({ photos, canUpload, windowEndsAt });
}
