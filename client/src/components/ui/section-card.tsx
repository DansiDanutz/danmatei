import { type HTMLAttributes } from "react";

export interface SectionCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  tone?: "default" | "elevated";
}

export function SectionCard({ hover = false, tone = "default", className = "", ...rest }: SectionCardProps) {
  const base = tone === "elevated"
    ? "rounded-3xl border border-white/10 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7"
    : "rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/40 p-5 sm:p-7";
  const hoverClass = hover
    ? "transition-all hover:-translate-y-0.5 hover:border-brand-cyan/20 hover:bg-[oklch(0.13_0.03_250)]/55"
    : "";
  return <div className={`${base} ${hoverClass} ${className}`} {...rest} />;
}
