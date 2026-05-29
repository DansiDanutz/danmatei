import { type HTMLAttributes } from "react";

const SIZE_CLASS: Record<"xs" | "sm" | "md" | "lg", string> = {
  xs: "size-4 border",
  sm: "size-6 border-2",
  md: "size-8 border-2",
  lg: "size-12 border-2",
};

export interface BrandSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof SIZE_CLASS;
}

export function BrandSpinner({ size = "sm", className, ...rest }: BrandSpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Se încarcă"
      className={`${SIZE_CLASS[size]} animate-spin rounded-full border-brand-cyan border-t-transparent ${className ?? ""}`}
      {...rest}
    />
  );
}
