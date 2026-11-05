import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Screen } from "@danmatei/ui";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Text, View } from "react-native";

import { authService } from "@/features/auth/auth-service";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/features/auth/schemas";

type LinkState = "checking" | "valid" | "invalid";

export default function ResetPassword() {
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // The link signs the user in with a recovery session; without one there is
  // nothing to update the password of (expired, already used, or opened by hand).
  useEffect(() => {
    let mounted = true;
    authService
      .hasSession()
      .then((has) => mounted && setLinkState(has ? "valid" : "invalid"))
      .catch(() => mounted && setLinkState("invalid"));
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async ({ password }: ResetPasswordInput) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await authService.updatePassword(password);
      router.replace("/tabs/home");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Încearcă din nou.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (linkState === "checking") {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (linkState === "invalid") {
    return (
      <Screen scroll>
        <View className="gap-2 mb-6">
          <Text className="text-3xl font-semibold text-ink dark:text-white">
            Link expirat
          </Text>
          <Text className="text-base text-slate-500 dark:text-slate-400">
            Linkul de resetare nu mai este valid. Cere unul nou.
          </Text>
        </View>
        <Link href="/auth/forgot-password">
          <Text className="text-brand-600 font-semibold">
            Trimite un link nou
          </Text>
        </Link>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View className="gap-2 mb-6">
        <Text className="text-3xl font-semibold text-ink dark:text-white">
          Parolă nouă
        </Text>
        <Text className="text-base text-slate-500 dark:text-slate-400">
          Alege o parolă nouă pentru contul tău.
        </Text>
      </View>

      <View className="gap-4">
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Parolă nouă"
              secureTextEntry
              autoComplete="new-password"
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
              autoComplete="new-password"
              value={value}
              onChangeText={onChange}
              error={errors.confirmPassword?.message}
            />
          )}
        />

        {submitError ? (
          <Text className="text-red-600">{submitError}</Text>
        ) : null}

        <Button
          label="Salvează parola"
          loading={submitting}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </Screen>
  );
}
