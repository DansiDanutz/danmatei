/**
 * StepIndicator — visualises the 3-step flow a parent walks through to
 * reach the AI call:
 *
 *   1. Completezi datele     (form on /programare)
 *   2. Primești linkul       (success card on /programare)
 *   3. Vorbești cu Andra     (pre-call screen on /apel)
 *
 * Each step gets a distinct accent colour so the parent can see at a
 * glance where they are in the journey: cyan → gold → emerald. The
 * current step gets a glowing ring + tinted background, completed steps
 * show a check mark, future steps are dimmed.
 */
import { Check } from "lucide-react";

export type Step = 1 | 2 | 3;

type StepDef = {
  label: string;
  /** Token used to build the tailwind classes for each accent. */
  accent: "cyan" | "gold" | "emerald";
};

const STEPS: ReadonlyArray<StepDef> = [
  { label: "Completezi datele", accent: "cyan" },
  { label: "Primești linkul", accent: "gold" },
  { label: "Vorbești cu Andra", accent: "emerald" },
];

/** Tailwind class fragments per accent — kept here so the indicator and
 *  the screen using it stay in sync. */
const ACCENT_CLASSES: Record<
  StepDef["accent"],
  {
    activeRing: string;
    activeText: string;
    activeBg: string;
    doneText: string;
  }
> = {
  cyan: {
    activeRing: "ring-brand-cyan/60 shadow-[0_0_28px_-8px_oklch(0.78_0.13_210/0.55)]",
    activeText: "text-brand-cyan",
    activeBg: "bg-brand-cyan/15",
    doneText: "text-brand-cyan/80",
  },
  gold: {
    activeRing: "ring-brand-gold/60 shadow-[0_0_28px_-8px_oklch(0.85_0.13_85/0.55)]",
    activeText: "text-brand-gold",
    activeBg: "bg-brand-gold/15",
    doneText: "text-brand-gold/80",
  },
  emerald: {
    activeRing:
      "ring-emerald-400/60 shadow-[0_0_28px_-8px_rgba(52,211,153,0.55)]",
    activeText: "text-emerald-300",
    activeBg: "bg-emerald-500/15",
    doneText: "text-emerald-300/80",
  },
};

export default function StepIndicator({ current }: { current: Step }) {
  return (
    <ol
      aria-label="Pașii apelului"
      className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left sm:grid-cols-3"
    >
      {STEPS.map((step, index) => {
        const stepNum = (index + 1) as Step;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        const colours = ACCENT_CLASSES[step.accent];

        return (
          <li
            key={step.label}
            aria-current={isActive ? "step" : undefined}
            className={[
              "flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all",
              isActive
                ? `${colours.activeBg} ring-1 ring-inset ${colours.activeRing}`
                : "ring-1 ring-inset ring-white/5",
            ].join(" ")}
          >
            <span
              className={[
                "grid size-7 shrink-0 place-items-center rounded-full font-heading text-[11px] font-bold tabular-nums transition-all",
                isActive
                  ? `${colours.activeBg} ${colours.activeText} ring-1 ${colours.activeRing}`
                  : isDone
                    ? `${colours.activeBg} ${colours.doneText}`
                    : "bg-white/[0.05] text-white/40 ring-1 ring-white/10",
              ].join(" ")}
            >
              {isDone ? <Check className="size-3.5" /> : stepNum}
            </span>
            <span
              className={[
                "font-heading text-[11px] uppercase tracking-[0.12em] transition-colors",
                isActive
                  ? `${colours.activeText} font-semibold`
                  : isDone
                    ? colours.doneText
                    : "text-white/40",
              ].join(" ")}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
