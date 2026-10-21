import { supabase } from "@/lib/supabase";

/**
 * Active trainers' display names, keyed by trainer id. Visitors and parents
 * can't read trainers' `profiles` rows (RLS), so the `profiles(full_name)`
 * embed comes back null for them; this RPC (migration 0031) exposes only the
 * names. Resolves to an empty map on error so callers keep their fallback.
 */
export async function fetchTrainerNames(): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("public_trainer_names");
  if (error || !data) return new Map();
  return new Map(
    (data as { trainer_id: string; full_name: string }[]).map((r) => [
      r.trainer_id,
      r.full_name,
    ])
  );
}
