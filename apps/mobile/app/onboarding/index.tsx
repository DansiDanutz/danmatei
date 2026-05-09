import { Button, Card, Screen } from "@danmatei/ui";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { onboardingSlides } from "@/features/onboarding/slides";

export default function Onboarding() {
  return (
    <Screen padded={false}>
      <View className="flex-1">
        <View className="h-[55%] bg-brand-900 overflow-hidden">
          <View className="absolute inset-0 items-center justify-end p-6">
            <Text className="text-white text-4xl font-semibold tracking-tight text-center">
              Școala de Fotbal{"\n"}
              <Text className="text-amber-400">Dan Matei</Text>
            </Text>
            <Text className="text-slate-300 mt-3 tracking-widest uppercase text-sm">
              Pasiune · Disciplină · Performanță
            </Text>
          </View>
        </View>

        <View className="flex-1 px-5 py-6 gap-3">
          {onboardingSlides.map((slide) => (
            <Card key={slide.id} elevated className="flex-row items-center gap-3">
              <View
                className="w-2 h-12 rounded-full"
                style={{ backgroundColor: slide.accent }}
              />
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink dark:text-white">
                  {slide.titleRo}
                </Text>
                <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {slide.bodyRo}
                </Text>
              </View>
            </Card>
          ))}

          <View className="mt-auto gap-3 pt-4">
            <Button
              label="Intră în cont"
              onPress={() => router.push("/auth/login")}
            />
            <Button
              label="Creează cont nou"
              variant="secondary"
              onPress={() => router.push("/auth/register")}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}
