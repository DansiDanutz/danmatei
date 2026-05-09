import type { PropsWithChildren } from "react";
import { View, type ViewProps } from "react-native";

export type CardProps = PropsWithChildren<
  ViewProps & {
    elevated?: boolean;
  }
>;

export function Card({ elevated, className, children, ...rest }: CardProps) {
  return (
    <View
      className={`rounded-2xl bg-surface dark:bg-surface-cardDark p-4 ${elevated ? "shadow-md shadow-black/5" : "border border-slate-100 dark:border-slate-800"} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </View>
  );
}
