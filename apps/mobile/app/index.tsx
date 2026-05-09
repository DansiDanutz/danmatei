import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useSession } from "@/features/auth/use-session";

export default function Index() {
  const { initialized, session } = useSession();

  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-surface dark:bg-surface-dark">
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={session ? "/tabs/home" : "/onboarding"} />;
}
