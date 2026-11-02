import type { ChatMessage, ChatThread } from "../../types/chat";

export const threadsKey = ["chat", "threads"] as const;
export const messagesKey = (threadId: string) =>
  ["chat", "threads", threadId, "messages"] as const;

// Messages are cached oldest first, the same order the server returns them.
export function appendMessage(
  messages: ChatMessage[] | undefined,
  message: ChatMessage,
): ChatMessage[] {
  const current = messages ?? [];
  return current.some((m) => m.id === message.id)
    ? current
    : [...current, message];
}

export function clearUnread(
  threads: ChatThread[] | undefined,
  threadId: string,
): ChatThread[] | undefined {
  return threads?.map((t) =>
    t.id === threadId ? { ...t, unreadCount: 0 } : t,
  );
}
