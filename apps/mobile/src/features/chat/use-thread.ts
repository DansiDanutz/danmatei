import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { appendMessage, clearUnread, messagesKey, threadsKey } from "./cache";
import { chatService } from "./chat-service";
import type { ChatMessage, ChatThread } from "@/types/chat";

export function useThread(threadId: string) {
  const queryClient = useQueryClient();

  const messages = useQuery({
    queryKey: messagesKey(threadId),
    queryFn: () => chatService.getMessages(threadId),
  });

  // Opening the thread marks it read. A failure is not shown: the badge stays
  // and the next open tries again.
  const markRead = useMutation({
    mutationFn: () => chatService.markRead(threadId),
    onSuccess: () =>
      queryClient.setQueryData<ChatThread[]>(threadsKey, (threads) =>
        clearUnread(threads, threadId),
      ),
  });
  const { mutate: markReadNow } = markRead;
  useEffect(() => {
    markReadNow();
  }, [markReadNow, threadId]);

  const send = useMutation({
    mutationFn: (content: string) => chatService.sendMessage(threadId, content),
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(messagesKey(threadId), (cached) =>
        appendMessage(cached, message),
      );
      // The thread moves to the top of the list.
      void queryClient.invalidateQueries({ queryKey: threadsKey, exact: true });
    },
  });

  return { messages, send };
}
