/**
 * Browser Supabase client. Reads `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` from the env. Sessions persist in localStorage.
 *
 * RLS in `supabase/migrations/0001_init.sql` is the source of truth for
 * what each role can read/write — never bypass it from the browser. For
 * privileged operations (creating trainers, signing upload URLs, fan-out
 * notifications), call into a serverless function under `/api`.
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing. " +
      "Auth-gated screens will be disabled until env is provisioned. " +
      "See README → Provisioning Supabase."
  );
}

export const FOTBAL_SCHEMA = "fotbal";

export const supabase = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "anon-placeholder",
  {
    db: { schema: FOTBAL_SCHEMA },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "scoala-fotbal-auth",
    },
  }
);

export const isSupabaseConfigured = Boolean(url && anonKey);
