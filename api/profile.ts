/**
 * GET and PUT /api/profile
 *
 * The signed-in user's profile for the mobile app. The email comes from
 * Supabase Auth (fotbal.profiles has none).
 *
 * Queries run through `userClient(jwt)`, so RLS applies. Both queries filter on
 * the caller's id: "profiles read self or owner" lets an owner read every row,
 * so without the filter an owner would get several rows.
 *
 * PUT accepts `fullName` only. Any other key rejects the whole request with 400
 * `forbidden_fields`, even beside a valid name. (The profiles_lock_role trigger
 * is a second guard for `role`; it silently keeps the old role.) Under RLS an
 * update that matches no row returns no error, so an empty result is a 404.
 *
 * Auth: bearer JWT. Design: docs/designs/mobile-profile-and-chat-backend.md.
 */
import { userClient } from "./_lib/supabase.js";
import {
  mapProfile,
  mobileRoute,
  parseProfileUpdate,
  sendError,
} from "./_lib/mobile-api.js";

const COLUMNS = "id, full_name, role, created_at";

export default mobileRoute(
  "profile",
  ["GET", "PUT"],
  async ({ req, res, jwt, user }) => {
    const db = userClient(jwt);

    if (req.method === "GET") {
      const { data, error } = await db
        .from("profiles")
        .select(COLUMNS)
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return sendError(res, 404, "not_found");
      return res.status(200).json(mapProfile(data, user.email));
    }

    const parsed = parseProfileUpdate(req.body);
    if (!parsed.ok) {
      return parsed.error === "forbidden_fields"
        ? sendError(
            res,
            400,
            "forbidden_fields",
            `Câmpuri nepermise: ${parsed.keys.join(", ")}.`
          )
        : sendError(res, 400, "invalid_body");
    }

    const { data, error } = await db
      .from("profiles")
      .update({ full_name: parsed.fullName })
      .eq("id", user.id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return sendError(res, 404, "not_found");
    return res.status(200).json(mapProfile(data, user.email));
  }
);
