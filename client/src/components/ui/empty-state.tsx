import { type ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "cyan" | "gold";
}

export function EmptyState({ icon, title, description, action, tone = "default" }: EmptyStateProps) {
  const toneClass = {
    default: "border-white/8 bg-white/[0.03]",
    cyan: "border-brand-cyan/20 bg-brand-cyan/[0.05]",
    gold: "border-brand-gold/20 bg-brand-gold/[0.05]",
  }[tone];
  return (
    <div className={`relative flex flex-col items-center justify-center gap-4 rounded-3xl border ${toneClass} px-6 py-12 text-center sm:py-16`}>
      {icon && (
        <div className="grid size-14 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/65">
          {icon}
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-heading text-base uppercase tracking-[0.18em] text-white/85">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm font-body text-sm leading-relaxed text-white/55">{description}</p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
