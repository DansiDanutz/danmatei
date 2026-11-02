import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import {
  applyMarkedRead,
  applySentMessage,
  messagesKey,
  shouldMarkRead,
} from "./cache";
import { chatService } from "./chat-service";

export function useThread(threadId: string) {
  const queryClient = useQueryClient();

  const messages = useQuery({
    queryKey: messagesKey(threadId),
    queryFn: () => chatService.getMessages(threadId),
  });

  // Opening the thread marks it read, after its messages have loaded. A failure
  // is not shown: the badge stays and the next open tries again.
  const markRead = useMutation({
    mutationFn: () => chatService.markRead(threadId),
    onSuccess: () => applyMarkedRead(queryClient, threadId),
  });
  const { mutate: markReadNow } = markRead;
  const markedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!shouldMarkRead(messages.isSuccess, markedFor.current, threadId))
      return;
    markedFor.current = threadId;
    markReadNow();
  }, [messages.isSuccess, markReadNow, threadId]);

  const send = useMutation({
    mutationFn: (content: string) => chatService.sendMessage(threadId, content),
    onSuccess: (message) => applySentMessage(queryClient, threadId, message),
  });

  return { messages, send };
}
