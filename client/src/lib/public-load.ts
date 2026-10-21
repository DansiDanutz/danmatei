/**
 * Request lifecycle shared by the public listing pages (/stiri, /rezultate,
 * /program, /turnee) so an outage is never shown as "nothing published":
 *
 *  - no answer within `timeoutMs` → "failed" (the page stops spinning);
 *  - an error or a thrown request   → "failed";
 *  - rows arrive, even after the timeout fired → "ready" (replaces "failed").
 *
 * Returns a cancel function for the effect cleanup; after cancelling, no
 * further state is reported.
 */
export type PublicLoadState<T> =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; rows: T[] };

export function startPublicLoad<T>(
  request: () => PromiseLike<{ data: T[] | null; error: unknown }>,
  onState: (state: PublicLoadState<T>) => void,
  timeoutMs = 6000
): () => void {
  let cancelled = false;
  const timeoutId = setTimeout(() => {
    if (!cancelled) onState({ status: "failed" });
  }, timeoutMs);

  void (async () => {
    try {
      const { data, error } = await request();
      if (cancelled) return;
      clearTimeout(timeoutId);
      onState(error ? { status: "failed" } : { status: "ready", rows: data ?? [] });
    } catch {
      if (cancelled) return;
      clearTimeout(timeoutId);
      onState({ status: "failed" });
    }
  })();

  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
}
