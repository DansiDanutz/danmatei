import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Screen } from "@danmatei/ui";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";

import { authService } from "@/features/auth/auth-service";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas";

export default function Register() {
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: RegisterInput) => {
    setSubmitting(true);
    try {
      await authService.signUp(values.email, values.password);
      Alert.alert(
        "Cont creat",
        "Verifică emailul pentru confirmare, apoi autentifică-te.",
      );
      router.replace("/auth/login");
    } catch (error) {
      Alert.alert(
        "Înregistrare eșuată",
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
          Cont nou
        </Text>
        <Text className="text-base text-slate-500 dark:text-slate-400">
          Înscrie-te în câteva secunde.
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
              autoComplete="password-new"
              value={value}
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Confirmă parola"
              secureTextEntry
              autoComplete="password-new"
              value={value}
              onChangeText={onChange}
              error={errors.confirmPassword?.message}
            />
          )}
        />

        <Button
          label="Creează cont"
          loading={submitting}
          onPress={handleSubmit(onSubmit)}
        />

        <View className="flex-row justify-center mt-2">
          <Text className="text-slate-500 dark:text-slate-400">Ai deja cont? </Text>
          <Link href="/auth/login">
            <Text className="text-brand-600 font-semibold">Intră în cont</Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
