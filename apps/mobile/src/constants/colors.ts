export const colors = {
  brand: "#3b82f6",
  brandDark: "#1d4ed8",
  ink: "#0b1020",
  muted: "#64748b",
  surface: "#ffffff",
  surfaceDark: "#0b1020",
  card: "#f8fafc",
  cardDark: "#111827",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
} as const;

export type ColorToken = keyof typeof colors;
