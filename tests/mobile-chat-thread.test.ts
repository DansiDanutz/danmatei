/**
 * Pure parts of the mobile chat thread screen: the send-form schema and the
 * React Query cache updates. The screen and hook need React Native, so they are
 * covered by the mobile typecheck, not here.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  appendMessage,
  clearUnread,
  messagesKey,
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

describe("appendMessage", () => {
  it("adds the new message last", () => {
    expect(appendMessage([msg("a")], msg("b")).map(m => m.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("starts a list when nothing is cached", () => {
    expect(appendMessage(undefined, msg("a"))).toHaveLength(1);
  });

  it("does not add a message that is already cached", () => {
    const cached = [msg("a")];
    expect(appendMessage(cached, msg("a"))).toBe(cached);
  });
});

describe("clearUnread", () => {
  it("zeroes only the opened thread", () => {
    const out = clearUnread([thread("t1", 3), thread("t2", 2)], "t1");
    expect(out?.map(t => t.unreadCount)).toEqual([0, 2]);
  });

  it("leaves an uncached list alone", () => {
    expect(clearUnread(undefined, "t1")).toBeUndefined();
  });
});

describe("query keys and wiring", () => {
  it("keeps the thread list key the Chat tab uses", () => {
    const tab = readFileSync("apps/mobile/app/tabs/chat.tsx", "utf8");
    expect(tab).toContain(`queryKey: ["chat", "threads"]`);
    expect([...threadsKey]).toEqual(["chat", "threads"]);
    expect([...messagesKey("t1")]).toEqual([
      "chat",
      "threads",
      "t1",
      "messages",
    ]);
  });

  it("calls markRead on open and the list opens the thread route", () => {
    const hook = readFileSync(
      "apps/mobile/src/features/chat/use-thread.ts",
      "utf8"
    );
    expect(hook).toContain("chatService.markRead(threadId)");
    const tab = readFileSync("apps/mobile/app/tabs/chat.tsx", "utf8");
    expect(tab).toContain(`pathname: "/chat/[id]"`);
  });
});
