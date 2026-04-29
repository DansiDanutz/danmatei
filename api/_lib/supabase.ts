/**
 * Server-side Supabase client used by Vercel serverless functions in `/api`.
 *
 * Two clients are exported:
 *   - `serviceClient()` — uses the service-role key. Bypasses RLS. Only
 *     for trusted server work (creating trainers, fan-out, signed URLs).
 *   - `userClient(jwt)` — passes the caller's JWT. Subject to RLS just
 *     like the browser client. Use this when the caller's identity must
 *     be honored.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON =
  process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;

function assertEnv() {
  if (!URL || !ANON) {
    throw new Error(
      "Supabase env missing on server: SUPABASE_URL and SUPABASE_ANON_KEY required."
    );
  }
}

export const FOTBAL_SCHEMA = "fotbal";

export function serviceClient(): SupabaseClient {
  assertEnv();
  if (!SERVICE) {
    throw new Error("SUPABASE_SERVICE_ROLE missing on server.");
  }
  return createClient(URL!, SERVICE, {
    db: { schema: FOTBAL_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(jwt: string): SupabaseClient {
  assertEnv();
  return createClient(URL!, ANON!, {
    db: { schema: FOTBAL_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

export async function getUserIdFromJwt(jwt: string): Promise<string> {
  assertEnv();
  const response = await fetch(`${URL}/auth/v1/user`, {
    headers: {
      apikey: ANON!,
      authorization: `Bearer ${jwt}`,
    },
  });
  if (!response.ok) {
    throw new Error("Not authenticated");
  }
  const user = (await response.json()) as { id?: string };
  if (!user.id) {
    throw new Error("Not authenticated");
  }
  return user.id;
}

export function getJwtFromHeader(auth: string | undefined): string | null {
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
