/**
 * The public listing pages render an empty state only for a successful empty
 * response and a load-error state for failures, so these transitions are what
 * keeps an outage from reading as "nothing published".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startPublicLoad,
  type PublicLoadState,
} from "../../client/src/lib/public-load";

type Row = { id: string };
const deferred = () => {
  let resolve!: (v: { data: Row[] | null; error: unknown }) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<{ data: Row[] | null; error: unknown }>(
    (res, rej) => {
      resolve = res;
      reject = rej;
    }
  );
  return { promise, resolve, reject };
};

describe("startPublicLoad", () => {
  let states: PublicLoadState<Row>[];
  const record = (s: PublicLoadState<Row>) => states.push(s);

  beforeEach(() => {
    states = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("reports an empty successful response as ready with no rows", async () => {
    startPublicLoad(async () => ({ data: [], error: null }), record);
    await vi.runAllTimersAsync();
    expect(states).toEqual([{ status: "ready", rows: [] }]);
  });

  it("treats a null payload without error as an empty list", async () => {
    startPublicLoad(async () => ({ data: null, error: null }), record);
    await vi.runAllTimersAsync();
    expect(states).toEqual([{ status: "ready", rows: [] }]);
  });

  it("reports a query error as failed, never as empty", async () => {
    startPublicLoad(
      async () => ({ data: null, error: { message: "permission denied" } }),
      record
    );
    await vi.runAllTimersAsync();
    expect(states).toEqual([{ status: "failed" }]);
  });

  it("reports a thrown request as failed", async () => {
    startPublicLoad(async () => {
      throw new Error("network down");
    }, record);
    await vi.runAllTimersAsync();
    expect(states).toEqual([{ status: "failed" }]);
  });

  it("fails after the timeout, then a late success replaces the error", async () => {
    const d = deferred();
    startPublicLoad(() => d.promise, record, 6000);
    await vi.advanceTimersByTimeAsync(6000);
    expect(states).toEqual([{ status: "failed" }]);

    d.resolve({ data: [{ id: "a" }], error: null });
    await vi.runAllTimersAsync();
    expect(states).toEqual([
      { status: "failed" },
      { status: "ready", rows: [{ id: "a" }] },
    ]);
  });

  it("does not time out when the answer arrives first", async () => {
    startPublicLoad(async () => ({ data: [{ id: "a" }], error: null }), record);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(states).toEqual([{ status: "ready", rows: [{ id: "a" }] }]);
  });

  it("reports nothing after cancellation", async () => {
    const d = deferred();
    const cancel = startPublicLoad(() => d.promise, record, 6000);
    cancel();
    d.resolve({ data: [{ id: "a" }], error: null });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(states).toEqual([]);
  });
});
