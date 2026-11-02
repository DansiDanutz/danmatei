import type { QueryClient } from "@tanstack/react-query";

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

// Mark the thread read only once its messages have loaded, and once per thread:
// a failed load must not clear a badge for messages the user never saw.
export function shouldMarkRead(
  messagesLoaded: boolean,
  lastMarkedThreadId: string | null,
  threadId: string,
): boolean {
  return messagesLoaded && lastMarkedThreadId !== threadId;
}

// A history fetch that started before the send could resolve after it with an
// older snapshot and drop the sent message. Cancel it first. With nothing cached
// (the first load was cancelled) append would hide the history, so refetch.
export async function applySentMessage(
  queryClient: QueryClient,
  threadId: string,
  message: ChatMessage,
): Promise<void> {
  const key = messagesKey(threadId);
  await queryClient.cancelQueries({ queryKey: key, exact: true });
  const cached = queryClient.getQueryData<ChatMessage[]>(key);
  if (cached) {
    queryClient.setQueryData<ChatMessage[]>(
      key,
      appendMessage(cached, message),
    );
  } else {
    void queryClient.invalidateQueries({ queryKey: key, exact: true });
  }
  // The thread moves to the top of the list.
  void queryClient.invalidateQueries({ queryKey: threadsKey, exact: true });
}

export function applyMarkedRead(
  queryClient: QueryClient,
  threadId: string,
): void {
  queryClient.setQueryData<ChatThread[]>(threadsKey, (threads) =>
    clearUnread(threads, threadId),
  );
}
