import type { PropsWithChildren } from "react";
import { ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type ScreenProps = PropsWithChildren<
  ViewProps & {
    scroll?: boolean;
    padded?: boolean;
  }
>;

export function Screen({
  scroll = false,
  padded = true,
  className,
  children,
  ...rest
}: ScreenProps) {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-surface dark:bg-surface-dark"
    >
      <Wrapper
        className={`flex-1 ${padded ? "px-5 py-4" : ""} ${className ?? ""}`}
        contentContainerStyle={scroll ? { paddingBottom: 32 } : undefined}
        {...(rest as object)}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}
