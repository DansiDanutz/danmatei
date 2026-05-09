import { Card, Screen } from "@danmatei/ui";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { chatService } from "@/features/chat/chat-service";
import { formatRelativeDate } from "@/utils/format";

export default function Chat() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["chat", "threads"],
    queryFn: chatService.listThreads,
  });

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <Card>
          <Text className="text-red-500 font-semibold">
            Eroare la încărcarea conversațiilor
          </Text>
          <Text className="text-brand-600 mt-3" onPress={() => refetch()}>
            Reîncearcă
          </Text>
        </Card>
      </Screen>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Screen>
        <Card>
          <Text className="text-lg font-semibold text-ink dark:text-white">
            Nicio conversație încă
          </Text>
          <Text className="text-sm text-slate-500 mt-1">
            Mesajele cu antrenorii vor apărea aici.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        renderItem={({ item }) => (
          <Card elevated>
            <View className="flex-row justify-between items-start">
              <Text className="text-base font-semibold text-ink dark:text-white flex-1">
                {item.title}
              </Text>
              {item.unreadCount > 0 ? (
                <View className="bg-brand-600 rounded-full px-2 py-0.5">
                  <Text className="text-xs text-white font-semibold">
                    {item.unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="text-xs text-slate-500 mt-2">
              {formatRelativeDate(item.updatedAt)}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}
