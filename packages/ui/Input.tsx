import { forwardRef } from "react";
import { TextInput, View, Text, type TextInputProps } from "react-native";

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, className, ...rest },
  ref,
) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-ink dark:text-white">{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#94a3b8"
        className={`rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 text-base text-ink dark:text-white ${error ? "border-red-500" : "border-slate-200 dark:border-slate-700"} ${className ?? ""}`}
        {...rest}
      />
      {error ? (
        <Text className="text-xs text-red-500" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
