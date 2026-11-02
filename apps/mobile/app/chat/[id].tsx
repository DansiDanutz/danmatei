import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Input, Screen } from "@danmatei/ui";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from "react-native";

import { MessageBubble } from "@/features/chat/MessageBubble";
import { messageSchema, type MessageInput } from "@/features/chat/schemas";
import { useThread } from "@/features/chat/use-thread";
import { useAuthStore } from "@/stores/auth-store";

export default function ChatThreadScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { messages, send } = useThread(id);
  const { control, handleSubmit, reset, getValues } = useForm<MessageInput>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: "" },
  });

  const onSend = handleSubmit(async ({ content }) => {
    try {
      await send.mutateAsync(content);
      // Keep anything typed while the send was pending.
      if (getValues("content").trim() === content) reset();
    } catch (error) {
      Alert.alert(
        "Mesajul nu a fost trimis",
        error instanceof Error ? error.message : "Încearcă din nou.",
      );
    }
  });

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center gap-3 px-5 py-3">
          <Text
            className="text-brand-600 text-base"
            accessibilityRole="button"
            onPress={() => router.back()}
          >
            Înapoi
          </Text>
          <Text
            className="flex-1 text-lg font-semibold text-ink dark:text-white"
            numberOfLines={1}
          >
            {title || "Conversație"}
          </Text>
        </View>

        {messages.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : messages.isError ? (
          <View className="p-5">
            <Card>
              <Text className="text-red-500 font-semibold">
                Eroare la încărcarea mesajelor
              </Text>
              <Text
                className="text-brand-600 mt-3"
                onPress={() => messages.refetch()}
              >
                Reîncearcă
              </Text>
            </Card>
          </View>
        ) : (
          <FlatList
            className="flex-1"
            inverted
            data={[...(messages.data ?? [])].reverse()}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20, gap: 8 }}
            ListEmptyComponent={
              <Card>
                <Text className="text-lg font-semibold text-ink dark:text-white">
                  Niciun mesaj încă
                </Text>
                <Text className="text-sm text-slate-500 mt-1">
                  Scrie primul mesaj mai jos.
                </Text>
              </Card>
            }
            renderItem={({ item }) => (
              <MessageBubble message={item} mine={item.authorId === userId} />
            )}
          />
        )}

        <View className="flex-row items-end gap-2 px-5 py-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="content"
              render={({ field, fieldState }) => (
                <Input
                  placeholder="Scrie un mesaj"
                  multiline
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>
          <Button label="Trimite" loading={send.isPending} onPress={onSend} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
