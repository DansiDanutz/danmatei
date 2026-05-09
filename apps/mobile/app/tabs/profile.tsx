import { Avatar, Button, Card, Screen } from "@danmatei/ui";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { authService } from "@/features/auth/auth-service";
import { profileService } from "@/features/profile/profile-service";
import { useAuthStore } from "@/stores/auth-store";

export default function Profile() {
  const reset = useAuthStore((state) => state.reset);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: profileService.me,
  });

  const onSignOut = async () => {
    await authService.signOut();
    reset();
    router.replace("/onboarding");
  };

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Card elevated className="items-center gap-3 py-8">
        <Avatar uri={profile?.avatarUrl ?? null} name={profile?.fullName} size={80} />
        <Text className="text-xl font-semibold text-ink dark:text-white">
          {profile?.fullName ?? "Utilizator"}
        </Text>
        <Text className="text-sm text-slate-500">{profile?.email}</Text>
      </Card>

      <View className="mt-6 gap-3">
        <Button label="Editează profilul" variant="secondary" onPress={() => {}} />
        <Button label="Ieși din cont" variant="danger" onPress={onSignOut} />
      </View>
    </Screen>
  );
}
