/**
 * GET /api/chat/threads
 *
 * The chat threads the signed-in user may see, for the mobile chat list. RLS
 * ("chat_threads visible") decides which; an owner or super_admin sees every
 * thread, so they reach the 100-row cap first. There is no pagination.
 *
 * Order: last message first, threads without messages last. The Supabase client
 * cannot order by coalesce(last_message_at, created_at).
 *
 * Unread counts come from fotbal.chat_unread_counts() (migration 0042). If that
 * call fails the whole request fails (500): a made-up count would be worse than
 * an error.
 *
 * Auth: bearer JWT. Design: docs/designs/mobile-profile-and-chat-backend.md.
 */
import { userClient } from "../../_lib/supabase.js";
import { mapThread, mobileRoute } from "../../_lib/mobile-api.js";

export default mobileRoute("chat/threads", ["GET"], async ({ res, jwt }) => {
  const db = userClient(jwt);

  const { data: threads, error } = await db
    .from("chat_threads")
    .select("id, kind, title, last_message_at, created_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = threads ?? [];
  if (!rows.length) return res.status(200).json([]);

  // The function returns a row for every visible thread, in no particular
  // order, and PostgREST caps a response at max_rows (1000). An owner who sees
  // more threads than that would lose counts for some of the 100 threads above,
  // and those would wrongly read 0. Filtering the result to the threads being
  // returned applies before the cap.
  const { data: counts, error: countError } = await db
    .rpc("chat_unread_counts")
    .in(
      "thread_id",
      rows.map(t => t.id)
    );
  if (countError) throw countError;

  // A thread created between the two calls has no row and counts as 0.
  const unread = new Map<string, number>(
    ((counts ?? []) as { thread_id: string; unread: number }[]).map(c => [
      c.thread_id,
      c.unread,
    ])
  );

  return res
    .status(200)
    .json(rows.map(t => mapThread(t, unread.get(t.id) ?? 0)));
});
