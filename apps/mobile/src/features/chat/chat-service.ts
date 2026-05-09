import { api } from "@/lib/api";
import type { ChatMessage, ChatThread } from "@/types/chat";

export const chatService = {
  listThreads: () => api.get<ChatThread[]>("/api/chat/threads"),
  getMessages: (threadId: string) =>
    api.get<ChatMessage[]>(`/api/chat/threads/${threadId}/messages`),
  sendMessage: (threadId: string, content: string) =>
    api.post<ChatMessage>(`/api/chat/threads/${threadId}/messages`, { content }),
};
