import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Screen } from "@danmatei/ui";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";

import { authService } from "@/features/auth/auth-service";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";

export default function Login() {
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginInput) => {
    setSubmitting(true);
    try {
      await authService.signIn(values.email, values.password);
      router.replace("/tabs/home");
    } catch (error) {
      Alert.alert(
        "Autentificare eșuată",
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
          Bun venit
        </Text>
        <Text className="text-base text-slate-500 dark:text-slate-400">
          Intră în contul tău Dan Matei.
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
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Parolă"
              secureTextEntry
              autoComplete="password"
              value={value}
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />

        <Link href="/auth/forgot-password" className="self-end">
          <Text className="text-brand-600 text-sm">Ai uitat parola?</Text>
        </Link>

        <Button
          label="Intră în cont"
          loading={submitting}
          onPress={handleSubmit(onSubmit)}
        />

        <View className="flex-row justify-center mt-2">
          <Text className="text-slate-500 dark:text-slate-400">
            Nu ai cont încă?{" "}
          </Text>
          <Link href="/auth/register">
            <Text className="text-brand-600 font-semibold">Creează cont</Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
