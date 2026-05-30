/**
 * Escape PostgREST LIKE/ILIKE metacharacters so user input is matched
 * literally. Without this, a `%` or `_` in a search box is treated as a
 * wildcard (e.g. `%` matches every row), which on `children` would leak the
 * whole roster of minors. Backslash is escaped first so it can't double-escape.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, ch => `\\${ch}`);
}
