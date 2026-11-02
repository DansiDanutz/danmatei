/**
 * GET and POST /api/chat/threads/:id/messages
 *
 * GET returns the newest 100 messages of a thread, oldest first. (The web chat
 * loads the oldest 100; this route deliberately does not copy that.)
 *
 * POST adds a message as the caller. `sender_id` is always the caller: any
 * `senderId` in the body is ignored. The "chat_messages send if member" policy
 * only accepts the row when the caller can see the thread, so a hidden thread
 * and a nonexistent one both fail the RLS check (42501) before the foreign key
 * and both return 404. Posting in an academy-wide `parents` thread is open to
 * every signed-in user by design.
 *
 * The rate limit is best-effort: checkRateLimit keeps its counters in one
 * function instance's memory.
 *
 * Auth: bearer JWT. Design: docs/designs/mobile-profile-and-chat-backend.md.
 */
import { userClient } from "../../../_lib/supabase.js";
import { checkRateLimit } from "../../../_lib/ratelimit.js";
import {
  mapMessage,
  mobileRoute,
  parseMessageBody,
  pgCode,
  readThreadId,
  sendError,
} from "../../../_lib/mobile-api.js";

const COLUMNS = "id, thread_id, sender_id, body, created_at";

export default mobileRoute(
  "chat/threads/[id]/messages",
  ["GET", "POST"],
  async ({ req, res, jwt, user }) => {
    const threadId = readThreadId(req);
    if (!threadId) return sendError(res, 400, "invalid_thread_id");
    const db = userClient(jwt);

    if (req.method === "GET") {
      // RLS hides a thread the caller may not see, so "hidden" and "missing"
      // look the same.
      const { data: thread, error } = await db
        .from("chat_threads")
        .select("id")
        .eq("id", threadId)
        .maybeSingle();
      if (error) throw error;
      if (!thread) return sendError(res, 404, "not_found");

      const { data: rows, error: messagesError } = await db
        .from("chat_messages")
        .select(COLUMNS)
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);
      if (messagesError) throw messagesError;
      return res
        .status(200)
        .json((rows ?? []).slice().reverse().map(mapMessage));
    }

    const body = parseMessageBody(req.body);
    if (!body.ok) return sendError(res, 400, "invalid_body");

    const limit = checkRateLimit(`chat-send:${user.id}`, 30, 60_000);
    if (!limit.ok) {
      res.setHeader?.("Retry-After", String(Math.ceil(limit.resetIn / 1000)));
      return sendError(res, 429, "rate_limited");
    }

    const { data, error } = await db
      .from("chat_messages")
      .insert({ thread_id: threadId, sender_id: user.id, body: body.content })
      .select(COLUMNS)
      .single();
    if (error) {
      if (pgCode(error) === "42501") return sendError(res, 404, "not_found");
      throw error;
    }
    return res.status(201).json(mapMessage(data));
  }
);
