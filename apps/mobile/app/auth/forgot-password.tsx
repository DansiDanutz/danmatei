import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Screen } from "@danmatei/ui";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";

import { authService } from "@/features/auth/auth-service";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas";

export default function ForgotPassword() {
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    setSubmitting(true);
    try {
      await authService.resetPassword(email);
      Alert.alert(
        "Email trimis",
        "Verifică inboxul pentru linkul de resetare a parolei.",
      );
      router.back();
    } catch (error) {
      Alert.alert(
        "Eroare",
        error instanceof Error ? error.message : "Încearcă din nou.",
      );
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
