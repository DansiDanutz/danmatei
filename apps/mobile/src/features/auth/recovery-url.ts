/**
 * Supabase reports a bad recovery link (expired, already used) by putting
 * `error` / `error_description` in the URL hash, or in the query for PKCE.
 */
export function hasRecoveryLinkError(hash: string, search: string): boolean {
  const params = new URLSearchParams(
    `${hash.replace(/^#/, "")}&${search.replace(/^\?/, "")}`
  );
  return params.has("error") || params.has("error_code");
}
