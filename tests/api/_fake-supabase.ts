/**
 * Test helpers for the mobile profile and chat handlers.
 *
 * `fakeDb` stands in for `userClient(jwt)`: `from(table)` and
 * `rpc(name, args)` return a chainable, awaitable object that records every
 * call and resolves to the next response queued for that target. These tests
 * prove mapping and error handling; who may read or write what is proved by the
 * pgTAP tests (supabase/tests/chat_access.test.sql, chat_reads.test.sql).
 */

export type Result = { data?: unknown; error?: unknown };
export type Call = { target: string; chain: [string, unknown[]][] };

const CHAIN_METHODS = [
  "select",
  "eq",
  "order",
  "limit",
  "insert",
  "update",
  "maybeSingle",
  "single",
] as const;

/**
 * `responses` maps a target (`from:<table>` or `rpc:<name>`) to a queue of
 * results, consumed one per `from()` or `rpc()` call.
 */
export function fakeDb(responses: Record<string, Result[]>) {
  const calls: Call[] = [];

  function chain(target: string, first?: [string, unknown[]]) {
    const call: Call = { target, chain: first ? [first] : [] };
    calls.push(call);
    const q: Record<string, unknown> = {
      then: (
        resolve: (v: unknown) => unknown,
        reject: (e: unknown) => unknown
      ) => {
        const queue = responses[target];
        if (!queue?.length) {
          return Promise.reject(
            new Error(`no fake response queued for ${target}`)
          ).then(resolve, reject);
        }
        return Promise.resolve({
          data: undefined,
          error: null,
          ...queue.shift()!,
        }).then(resolve, reject);
      },
    };
    for (const m of CHAIN_METHODS) {
      q[m] = (...args: unknown[]) => {
        call.chain.push([m, args]);
        return q;
      };
    }
    return q;
  }

  return {
    calls,
    client: {
      from: (table: string) => chain(`from:${table}`),
      rpc: (name: string, args?: unknown) =>
        chain(`rpc:${name}`, ["rpc", [name, args]]),
    },
  };
}

/** `n` copies of one result, for tests that call a route many times. */
export function repeat(result: Result, n: number): Result[] {
  return Array.from({ length: n }, () => ({ ...result }));
}

export function makeReq(init: {
  method?: string;
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}) {
  const token = init.token === undefined ? "tok" : init.token;
  return {
    method: init.method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: init.body,
    query: init.query,
  };
}

/** A response recorder with the shape the handlers use. */
export function makeRes() {
  const out: {
    status: number | undefined;
    body: unknown;
    headers: Record<string, string>;
    ended: boolean;
  } = { status: undefined, body: undefined, headers: {}, ended: false };
  const res = {
    status(n: number) {
      out.status = n;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
    end() {
      out.ended = true;
      return res;
    },
    setHeader(k: string, v: string) {
      out.headers[k] = v;
    },
  };
  return { res, out };
}

export const THREAD_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_THREAD_ID = "22222222-2222-4222-8222-222222222222";
