/**
 * Logic of the mobile chat thread screen that does not need React Native: the
 * send-form schema and the React Query cache updates, run against a real
 * QueryClient. The screen and the hook are covered by the mobile typecheck.
 */
import { describe, expect, it } from "vitest";

import { QueryClient } from "../apps/mobile/node_modules/@tanstack/react-query";
import {
  appendMessage,
  applyMarkedRead,
  applySentMessage,
  clearUnread,
  messagesKey,
  shouldMarkRead,
  threadsKey,
} from "../apps/mobile/src/features/chat/cache";
import { messageSchema } from "../apps/mobile/src/features/chat/schemas";
import type { ChatMessage, ChatThread } from "../apps/mobile/src/types/chat";

const msg = (id: string): ChatMessage => ({
  id,
  threadId: "t1",
  authorId: "u1",
  content: id,
  createdAt: "2026-11-02T10:00:00Z",
});
const thread = (id: string, unreadCount: number): ChatThread => ({
  id,
  title: id,
  updatedAt: "2026-11-02T10:00:00Z",
  unreadCount,
});
const ids = (list: ChatMessage[] | undefined) => list?.map(m => m.id);

describe("messageSchema", () => {
  it("trims and accepts 1 to 4000 characters", () => {
    expect(messageSchema.parse({ content: "  salut  " }).content).toBe("salut");
    expect(messageSchema.safeParse({ content: "a".repeat(4000) }).success).toBe(
      true
    );
  });

  it("rejects empty, whitespace-only and over-long content", () => {
    expect(messageSchema.safeParse({ content: "" }).success).toBe(false);
    expect(messageSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(messageSchema.safeParse({ content: "a".repeat(4001) }).success).toBe(
      false
    );
  });
});

describe("appendMessage and clearUnread", () => {
  it("appends last, and ignores a message that is already cached", () => {
    const cached = [msg("a")];
    expect(ids(appendMessage(cached, msg("b")))).toEqual(["a", "b"]);
    expect(appendMessage(cached, msg("a"))).toBe(cached);
    expect(appendMessage(undefined, msg("a"))).toHaveLength(1);
  });

  it("zeroes only the opened thread", () => {
    const out = clearUnread([thread("t1", 3), thread("t2", 2)], "t1");
    expect(out?.map(t => t.unreadCount)).toEqual([0, 2]);
    expect(clearUnread(undefined, "t1")).toBeUndefined();
  });
});

describe("shouldMarkRead", () => {
  it("waits for the messages to load", () => {
    expect(shouldMarkRead(false, null, "t1")).toBe(false);
    expect(shouldMarkRead(true, null, "t1")).toBe(true);
  });

  it("marks each thread once", () => {
    expect(shouldMarkRead(true, "t1", "t1")).toBe(false);
    expect(shouldMarkRead(true, "t1", "t2")).toBe(true);
  });
});

describe("applyMarkedRead", () => {
  it("clears the badge in the cached thread list", () => {
    const qc = new QueryClient();
    qc.setQueryData(threadsKey, [thread("t1", 3), thread("t2", 2)]);
    applyMarkedRead(qc, "t1");
    const out = qc.getQueryData<ChatThread[]>(threadsKey);
    expect(out?.map(t => t.unreadCount)).toEqual([0, 2]);
  });
});

describe("applySentMessage", () => {
  it("appends to the cached messages and refreshes the thread list", async () => {
    const qc = new QueryClient();
    qc.setQueryData(messagesKey("t1"), [msg("a")]);
    qc.setQueryData(threadsKey, [thread("t1", 0)]);
    await applySentMessage(qc, "t1", msg("b"));
    expect(ids(qc.getQueryData(messagesKey("t1")))).toEqual(["a", "b"]);
    expect(qc.getQueryState(threadsKey)?.isInvalidated).toBe(true);
    // Replies that arrived since the last visit still have to load.
    expect(qc.getQueryState(messagesKey("t1"))?.isInvalidated).toBe(true);
  });

  it("keeps the sent message when an older history fetch resolves late", async () => {
    const qc = new QueryClient();
    qc.setQueryData(messagesKey("t1"), [msg("a")]);
    let release: (v: ChatMessage[]) => void = () => {};
    // Started before the send, so it holds a snapshot without the new message.
    const inFlight = qc
      .fetchQuery({
        queryKey: messagesKey("t1"),
        queryFn: () =>
          new Promise<ChatMessage[]>(resolve => {
            release = resolve;
          }),
        staleTime: 0,
      })
      .catch(() => undefined);

    await applySentMessage(qc, "t1", msg("b"));
    release([msg("a")]);
    await inFlight;

    expect(ids(qc.getQueryData(messagesKey("t1")))).toEqual(["a", "b"]);
  });

  it("refetches the history instead of showing only the sent message", async () => {
    const qc = new QueryClient();
    let release: (v: ChatMessage[]) => void = () => {};
    // The first load is still running when the send finishes.
    const firstLoad = qc
      .fetchQuery({
        queryKey: messagesKey("t1"),
        queryFn: () =>
          new Promise<ChatMessage[]>(resolve => {
            release = resolve;
          }),
      })
      .catch(() => undefined);

    await applySentMessage(qc, "t1", msg("b"));
    release([msg("a")]);
    await firstLoad;

    expect(qc.getQueryData(messagesKey("t1"))).toBeUndefined();
    expect(qc.getQueryState(messagesKey("t1"))?.isInvalidated).toBe(true);
  });
});
