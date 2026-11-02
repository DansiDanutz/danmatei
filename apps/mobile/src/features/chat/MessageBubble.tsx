import { Text, View } from "react-native";

import { formatRelativeDate } from "@/utils/format";
import type { ChatMessage } from "@/types/chat";

export function MessageBubble({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}) {
  return (
    <View
      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
        mine
          ? "self-end bg-brand-600"
          : "self-start bg-slate-100 dark:bg-slate-800"
      }`}
    >
      <Text
        className={`text-base ${mine ? "text-white" : "text-ink dark:text-white"}`}
      >
        {message.content}
      </Text>
      <Text
        className={`mt-1 text-xs ${mine ? "text-white/70" : "text-slate-500"}`}
      >
        {formatRelativeDate(message.createdAt)}
      </Text>
    </View>
  );
}
