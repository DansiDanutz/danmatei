import { Card, Screen } from "@danmatei/ui";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Text, View } from "react-native";

import { profileService } from "@/features/profile/profile-service";

export default function Home() {
  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: profileService.me,
  });

  return (
    <Screen scroll>
      <Text className="text-2xl font-semibold text-ink dark:text-white">
        Bună,{" "}
        <Text className="text-brand-600">
          {profile?.fullName ?? "antrenor"}
        </Text>
      </Text>
      <Text className="text-base text-slate-500 dark:text-slate-400 mt-1">
        Iată ce e nou la academie.
      </Text>

      <View className="mt-6 gap-3">
        {isLoading ? (
          <Card>
            <View className="py-8 items-center">
              <ActivityIndicator />
            </View>
          </Card>
        ) : isError ? (
          <Card>
            <Text className="text-red-500 font-semibold">
              Nu am putut încărca datele
            </Text>
            <Text className="text-sm text-slate-500 mt-1">
              {error instanceof Error ? error.message : "Eroare necunoscută"}
            </Text>
            <Text
              className="text-brand-600 mt-3"
              onPress={() => refetch()}
            >
              Reîncearcă
            </Text>
          </Card>
        ) : (
          <>
            <Card elevated>
              <Text className="text-sm text-slate-500">Următorul antrenament</Text>
              <Text className="text-lg font-semibold text-ink dark:text-white mt-1">
                Marți, 17:30 — Grupa U10
              </Text>
            </Card>
            <Card elevated>
              <Text className="text-sm text-slate-500">Notificări noi</Text>
              <Text className="text-lg font-semibold text-ink dark:text-white mt-1">
                3 mesaje
              </Text>
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}
