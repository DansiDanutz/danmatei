import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Screen } from "@danmatei/ui";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Platform, Text, View } from "react-native";

import { authService } from "@/features/auth/auth-service";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas";

export default function ForgotPassword() {
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(
    null
  );
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  // Alert.alert does nothing on web, so there the result is shown inline and
  // the screen stays open.
  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    setSubmitting(true);
    setNotice(null);
    try {
      await authService.resetPassword(email);
      const text = "Verifică inboxul pentru linkul de resetare a parolei.";
      if (Platform.OS === "web") {
        setNotice({ error: false, text: `Email trimis. ${text}` });
      } else {
        Alert.alert("Email trimis", text);
        router.back();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Încearcă din nou.";
      if (Platform.OS === "web") {
        setNotice({ error: true, text });
      } else {
        Alert.alert("Eroare", text);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <View className="gap-2 mb-6">
        <Text className="text-3xl font-semibold text-ink dark:text-white">
          Resetare parolă
        </Text>
        <Text className="text-base text-slate-500 dark:text-slate-400">
          Îți trimitem un link pe email.
        </Text>
      </View>

      <View className="gap-4">
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              error={errors.email?.message}
            />
          )}
        />

        {notice ? (
          <Text
            className={notice.error ? "text-red-600" : "text-brand-600"}
            accessibilityRole="alert"
          >
            {notice.text}
          </Text>
        ) : null}

        <Button
          label="Trimite link"
          loading={submitting}
          onPress={handleSubmit(onSubmit)}
        />

        <View className="flex-row justify-center mt-2">
          <Link href="/auth/login">
            <Text className="text-brand-600 font-semibold">
              Înapoi la autentificare
            </Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
