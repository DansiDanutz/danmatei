/**
 * Shared plumbing for the mobile profile and chat routes (/api/profile and
 * /api/chat/...). Design: docs/designs/mobile-profile-and-chat-backend.md.
 *
 * Every route here queries through `userClient(jwt)` so RLS decides access.
 * This module deliberately never imports `serviceClient`.
 *
 * Responses follow the repo's `{ error: "<snake_case code>" }` convention and
 * add a Romanian `message`, because the mobile `ApiError` shows `message` and
 * otherwise falls back to "Request failed with status N".
 */
import { z } from "zod";
import { getAuthUser, getJwtFromHeader } from "./supabase.js";

export type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

export type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
  end: () => unknown;
  setHeader?: (k: string, v: string) => void;
};

export type MobileUser = { id: string; email: string };
export type MobileContext = {
  req: Req;
  res: Res;
  jwt: string;
  user: MobileUser;
};

export type ErrorCode =
  | "method_not_allowed"
  | "missing_bearer"
  | "invalid_jwt"
  | "invalid_thread_id"
  | "invalid_body"
  | "forbidden_fields"
  | "not_found"
  | "rate_limited"
  | "server_error";

const MESSAGES: Record<ErrorCode, string> = {
  method_not_allowed: "Metodă nepermisă.",
  missing_bearer: "Nu ești autentificat.",
  invalid_jwt: "Nu ești autentificat.",
  invalid_thread_id: "Identificator invalid.",
  invalid_body: "Date invalide.",
  forbidden_fields: "Câmpuri nepermise.",
  not_found: "Nu a fost găsit.",
  rate_limited: "Prea multe mesaje. Încearcă din nou în câteva secunde.",
  server_error: "Eroare de server.",
};

export function sendError(
  res: Res,
  status: number,
  error: ErrorCode,
  message?: string
) {
  return res
    .status(status)
    .json({ error, message: message ?? MESSAGES[error] });
}

/** Logs the route and the error, sends a 500 that never echoes database text. */
export function serverError(res: Res, route: string, err: unknown) {
  console.error(
    `[${route}]`,
    err instanceof Error ? err.message : JSON.stringify(err)
  );
  return sendError(res, 500, "server_error");
}

/** Postgres SQLSTATE of a Supabase error, if any. */
export function pgCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Reads the bearer token and resolves the caller; sends the 401 on failure. */
export async function authenticate(
  req: Req,
  res: Res
): Promise<{ jwt: string; user: MobileUser } | null> {
  const jwt = getJwtFromHeader(readHeader(req, "authorization"));
  if (!jwt) {
    sendError(res, 401, "missing_bearer");
    return null;
  }
  try {
    const user = await getAuthUser(jwt);
    // The app signs in with email only.
    if (!user.email) {
      sendError(res, 401, "invalid_jwt");
      return null;
    }
    return { jwt, user: { id: user.id, email: user.email } };
  } catch {
    sendError(res, 401, "invalid_jwt");
    return null;
  }
}

// Origins of the Expo Web dev server (Metro and the legacy webpack port).
const DEV_WEB_ORIGINS = ["http://localhost:8081", "http://localhost:19006"];

/**
 * Origins allowed to call these routes from a browser: the Expo Web dev server
 * plus the comma-separated `MOBILE_WEB_ORIGINS` (exact origins, no paths).
 */
export function allowedWebOrigins(): string[] {
  const extra = (process.env.MOBILE_WEB_ORIGINS ?? "")
    .split(",")
    .map(o => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return [...DEV_WEB_ORIGINS, ...extra];
}

/**
 * CORS for browser callers (Expo Web). Auth is a bearer header, never a cookie,
 * so no credentials mode is needed and only listed origins get the headers.
 * Returns true when it answered a preflight (OPTIONS), which carries no
 * credentials and so is answered before the method check and authentication.
 */
export function applyCors(
  req: Req,
  res: Res,
  methods: readonly string[]
): boolean {
  const origin = readHeader(req, "origin");
  res.setHeader?.("Vary", "Origin");
  if (origin && allowedWebOrigins().includes(origin)) {
    res.setHeader?.("Access-Control-Allow-Origin", origin);
    if (req.method === "OPTIONS") {
      res.setHeader?.(
        "Access-Control-Allow-Methods",
        [...methods, "OPTIONS"].join(", ")
      );
      res.setHeader?.(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type"
      );
      res.setHeader?.("Access-Control-Max-Age", "600");
    } else {
      res.setHeader?.("Access-Control-Expose-Headers", "Retry-After");
    }
  }
  if (req.method !== "OPTIONS") return false;
  res.status(204).end();
  return true;
}

/**
 * Wraps a route: CORS (and the OPTIONS preflight), method check (405),
 * authentication (401), then `fn`. Anything `fn` throws becomes a logged 500.
 */
export function mobileRoute(
  route: string,
  methods: readonly string[],
  fn: (ctx: MobileContext) => Promise<unknown>
) {
  return async function handler(req: Req, res: Res) {
    if (applyCors(req, res, methods)) return;
    if (!req.method || !methods.includes(req.method)) {
      return sendError(res, 405, "method_not_allowed");
    }
    const auth = await authenticate(req, res);
    if (!auth) return;
    try {
      await fn({ req, res, ...auth });
    } catch (err) {
      serverError(res, route, err);
    }
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `req.query.id` if it is a single UUID string, else null. */
export function readThreadId(req: Req): string | null {
  const id = req.query?.id;
  return typeof id === "string" && UUID_RE.test(id) ? id : null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const FullName = z.string().trim().min(2).max(120);

export type ProfileUpdate =
  | { ok: true; fullName: string }
  | { ok: false; error: "invalid_body" }
  | { ok: false; error: "forbidden_fields"; keys: string[] };

/** Only `fullName` may be updated; any other key rejects the whole request. */
export function parseProfileUpdate(body: unknown): ProfileUpdate {
  if (!isPlainObject(body)) return { ok: false, error: "invalid_body" };
  const keys = Object.keys(body).filter(k => k !== "fullName");
  if (keys.length) return { ok: false, error: "forbidden_fields", keys };
  const parsed = FullName.safeParse(body.fullName);
  if (!parsed.success) return { ok: false, error: "invalid_body" };
  return { ok: true, fullName: parsed.data };
}

const Content = z.string().trim().min(1).max(4000);

/** `content` of a new message; other keys (such as a `senderId`) are ignored. */
export function parseMessageBody(
  body: unknown
): { ok: true; content: string } | { ok: false } {
  if (!isPlainObject(body)) return { ok: false };
  const parsed = Content.safeParse(body.content);
  return parsed.success ? { ok: true, content: parsed.data } : { ok: false };
}

type Row = Record<string, any>;

export function mapProfile(row: Row, email: string) {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    email,
    role: row.role as string,
    createdAt: row.created_at as string,
  };
}

const KIND_TITLES: Record<string, string> = {
  parent_trainer: "Antrenor",
  group: "Grupa",
  parents: "Părinți",
};

export function mapThread(row: Row, unread: number) {
  const title =
    typeof row.title === "string" && row.title
      ? row.title
      : KIND_TITLES[row.kind];
  return {
    id: row.id as string,
    title: title ?? "",
    updatedAt: (row.last_message_at ?? row.created_at) as string,
    unreadCount: unread,
  };
}

export function mapMessage(row: Row) {
  return {
    id: row.id as string,
    threadId: row.thread_id as string,
    authorId: row.sender_id as string,
    content: row.body as string,
    createdAt: row.created_at as string,
  };
}
