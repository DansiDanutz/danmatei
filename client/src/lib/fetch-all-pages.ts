/**
 * Read every row of a query whose result can exceed one response.
 * PostgREST caps each response (Supabase's max-rows setting), so callers
 * that compute totals must page until a short page proves the end.
 * Stops at the first error and reports it with the rows read so far.
 */
export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
