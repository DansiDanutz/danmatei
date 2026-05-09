import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
  type View,
} from "react-native";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand-600 active:bg-brand-500",
  secondary: "bg-slate-100 dark:bg-slate-800 active:opacity-80",
  ghost: "bg-transparent active:bg-slate-100 dark:active:bg-slate-800",
  danger: "bg-red-500 active:bg-red-600",
};

const variantTextClass: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-ink dark:text-white",
  ghost: "text-brand-600",
  danger: "text-white",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-2 rounded-xl",
  md: "px-4 py-3 rounded-2xl",
  lg: "px-5 py-4 rounded-2xl",
};

const sizeTextClass: Record<Size, string> = {
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-lg font-semibold",
};

export type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<View, ButtonProps>(function Button(
  { label, variant = "primary", size = "md", loading, disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      className={`${variantClass[variant]} ${sizeClass[size]} flex-row items-center justify-center ${isDisabled ? "opacity-50" : ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? "#0b1020" : "#fff"} />
      ) : (
        <Text className={`${variantTextClass[variant]} ${sizeTextClass[size]}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
});
