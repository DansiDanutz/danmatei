/**
 * POST /api/chat/threads/:id/read
 *
 * Marks a thread as read for the caller by calling fotbal.chat_mark_read
 * (migration 0042), which upserts the caller's chat_reads row using the
 * database clock. A thread the caller cannot see, or that does not exist, fails
 * the table's RLS check (42501) and returns 404.
 *
 * Returns 204 with no body. The request body is not read, although the mobile
 * client sends a JSON content type with none.
 *
 * Auth: bearer JWT. Design: docs/designs/mobile-profile-and-chat-backend.md.
 */
import { userClient } from "../../../_lib/supabase.js";
import {
  mobileRoute,
  pgCode,
  readThreadId,
  sendError,
} from "../../../_lib/mobile-api.js";

export default mobileRoute(
  "chat/threads/[id]/read",
  ["POST"],
  async ({ req, res, jwt }) => {
    const threadId = readThreadId(req);
    if (!threadId) return sendError(res, 400, "invalid_thread_id");

    const { error } = await userClient(jwt).rpc("chat_mark_read", {
      p_thread: threadId,
    });
    if (error) {
      if (pgCode(error) === "42501") return sendError(res, 404, "not_found");
      throw error;
    }
    return res.status(204).end();
  }
);
