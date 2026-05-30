import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Menu } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export type SectionTone =
  | "cyan"
  | "blue"
  | "emerald"
  | "green"
  | "amber"
  | "rose"
  | "violet"
  | "teal"
  | "indigo"
  | "slate";

export type MobileSection<T extends string = string> = {
  value: T;
  label: string;
  description: string;
  group: string;
  icon: ReactNode;
  tone: SectionTone;
  badge?: string;
  action?: string;
};

const TONE: Record<
  SectionTone,
  {
    card: string;
    icon: string;
    badge: string;
    trigger: string;
  }
> = {
  cyan: {
    card: "border-brand-cyan/30 bg-brand-cyan/[0.08]",
    icon: "border-brand-cyan/35 bg-brand-cyan/15 text-brand-cyan",
    badge: "border-brand-cyan/35 bg-brand-cyan/15 text-brand-cyan",
    trigger:
      "data-[state=active]:bg-brand-cyan/15 data-[state=active]:text-brand-cyan",
  },
  blue: {
    card: "border-sky-400/30 bg-sky-400/[0.08]",
    icon: "border-sky-400/35 bg-sky-400/15 text-sky-200",
    badge: "border-sky-400/35 bg-sky-400/15 text-sky-200",
    trigger:
      "data-[state=active]:bg-sky-400/15 data-[state=active]:text-sky-200",
  },
  emerald: {
    card: "border-emerald-400/30 bg-emerald-400/[0.08]",
    icon: "border-emerald-400/35 bg-emerald-400/15 text-emerald-200",
    badge: "border-emerald-400/35 bg-emerald-400/15 text-emerald-200",
    trigger:
      "data-[state=active]:bg-emerald-400/15 data-[state=active]:text-emerald-200",
  },
  green: {
    card: "border-lime-300/30 bg-lime-300/[0.08]",
    icon: "border-lime-300/35 bg-lime-300/15 text-lime-200",
    badge: "border-lime-300/35 bg-lime-300/15 text-lime-200",
    trigger:
      "data-[state=active]:bg-lime-300/15 data-[state=active]:text-lime-200",
  },
  amber: {
    card: "border-brand-gold/35 bg-brand-gold/[0.08]",
    icon: "border-brand-gold/40 bg-brand-gold/15 text-brand-gold",
    badge: "border-brand-gold/40 bg-brand-gold/15 text-brand-gold",
    trigger:
      "data-[state=active]:bg-brand-gold/15 data-[state=active]:text-brand-gold",
  },
  rose: {
    card: "border-rose-300/30 bg-rose-300/[0.08]",
    icon: "border-rose-300/35 bg-rose-300/15 text-rose-200",
    badge: "border-rose-300/35 bg-rose-300/15 text-rose-200",
    trigger:
      "data-[state=active]:bg-rose-300/15 data-[state=active]:text-rose-200",
  },
  violet: {
    card: "border-violet-300/30 bg-violet-300/[0.08]",
    icon: "border-violet-300/35 bg-violet-300/15 text-violet-200",
    badge: "border-violet-300/35 bg-violet-300/15 text-violet-200",
    trigger:
      "data-[state=active]:bg-violet-300/15 data-[state=active]:text-violet-200",
  },
  teal: {
    card: "border-teal-300/30 bg-teal-300/[0.08]",
    icon: "border-teal-300/35 bg-teal-300/15 text-teal-200",
    badge: "border-teal-300/35 bg-teal-300/15 text-teal-200",
    trigger:
      "data-[state=active]:bg-teal-300/15 data-[state=active]:text-teal-200",
  },
  indigo: {
    card: "border-indigo-300/30 bg-indigo-300/[0.08]",
    icon: "border-indigo-300/35 bg-indigo-300/15 text-indigo-200",
    badge: "border-indigo-300/35 bg-indigo-300/15 text-indigo-200",
    trigger:
      "data-[state=active]:bg-indigo-300/15 data-[state=active]:text-indigo-200",
  },
  slate: {
    card: "border-white/14 bg-white/[0.045]",
    icon: "border-white/15 bg-white/[0.07] text-white/80",
    badge: "border-white/15 bg-white/[0.07] text-white/70",
    trigger:
      "data-[state=active]:bg-white/[0.08] data-[state=active]:text-white",
  },
};

export function sectionTriggerClass(tone: SectionTone) {
  return cn(
    "flex-none snap-center rounded-full px-4 py-2 font-heading text-[12px] uppercase tracking-[0.14em] text-white/65 transition-colors md:flex-1 md:px-3 md:text-[11px] md:tracking-[0.16em]",
    TONE[tone].trigger
  );
}

type MobileSectionHomeProps<T extends string> = {
  title: string;
  subtitle: string;
  sections: MobileSection<T>[];
  onSelect: (value: T) => void;
  className?: string;
};

export function MobileSectionHome<T extends string>({
  title,
  subtitle,
  sections,
  onSelect,
  className,
}: MobileSectionHomeProps<T>) {
  const groups = useMemo(() => {
    const result: { name: string; sections: MobileSection<T>[] }[] = [];
    for (const section of sections) {
      let group = result.find(g => g.name === section.group);
      if (!group) {
        group = { name: section.group, sections: [] };
        result.push(group);
      }
      group.sections.push(section);
    }
    return result;
  }, [sections]);

  return (
    <section className={cn("mt-6 space-y-5 md:hidden", className)}>
      <header>
        <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-[0.02em] text-white">
          {title}
        </h2>
        <p className="mt-1 font-body text-sm leading-relaxed text-white/58">
          {subtitle}
        </p>
      </header>

      {groups.map(group => (
        <div key={group.name} className="space-y-2.5">
          <h3 className="font-heading text-[10px] uppercase tracking-[0.22em] text-white/42">
            {group.name}
          </h3>
          <div className="grid gap-2.5">
            {group.sections.map(section => (
              <SectionButton
                key={section.value}
                section={section}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

type MobileSectionHeaderProps<T extends string> = {
  rootLabel: string;
  section: MobileSection<T>;
  sections: MobileSection<T>[];
  onBack: () => void;
  onSelect: (value: T) => void;
};

export function MobileSectionHeader<T extends string>({
  rootLabel,
  section,
  sections,
  onBack,
  onSelect,
}: MobileSectionHeaderProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-[57px] z-30 -mx-4 mt-4 border-y border-white/8 bg-[oklch(0.08_0.02_250)]/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/75"
          aria-label={`Înapoi la ${rootLabel}`}
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-[9px] uppercase tracking-[0.22em] text-white/38">
            {rootLabel}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border",
                TONE[section.tone].icon
              )}
            >
              {section.icon}
            </span>
            <h2 className="truncate font-heading text-lg font-bold uppercase tracking-[0.02em] text-white">
              {section.label}
            </h2>
          </div>
        </div>
        <Drawer open={open} onOpenChange={setOpen}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 font-heading text-[10px] uppercase tracking-[0.16em] text-white/75"
          >
            <Menu className="size-3.5" />
            Meniu
          </button>
          <DrawerContent className="max-h-[82vh] rounded-t-3xl border-white/10 bg-[oklch(0.09_0.02_250)] text-white">
            <DrawerHeader className="text-left">
              <DrawerTitle className="font-heading text-xl uppercase tracking-[0.02em] text-white">
                {rootLabel}
              </DrawerTitle>
            </DrawerHeader>
            <div className="grid gap-2 overflow-y-auto px-4 pb-5">
              {sections.map(item => (
                <DrawerClose asChild key={item.value}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.value)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-3 text-left transition",
                      item.value === section.value
                        ? TONE[item.tone].card
                        : "border-white/8 bg-white/[0.025]"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl border",
                        TONE[item.tone].icon
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading text-sm uppercase tracking-[0.08em] text-white">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block truncate font-body text-xs text-white/52">
                        {item.description}
                      </span>
                    </span>
                  </button>
                </DrawerClose>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}

function SectionButton<T extends string>({
  section,
  onSelect,
}: {
  section: MobileSection<T>;
  onSelect: (value: T) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(section.value)}
      className={cn(
        "group flex min-h-[88px] items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]",
        TONE[section.tone].card
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl border",
          TONE[section.tone].icon
        )}
      >
        {section.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-heading text-base uppercase tracking-[0.05em] text-white">
            {section.label}
          </span>
          {section.badge && (
            <span
              className={cn(
                "ml-auto rounded-full border px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.14em]",
                TONE[section.tone].badge
              )}
            >
              {section.badge}
            </span>
          )}
        </span>
        <span className="mt-1 block font-body text-[13px] leading-snug text-white/62">
          {section.description}
        </span>
        <span className="mt-2 inline-flex items-center gap-1 font-heading text-[10px] uppercase tracking-[0.16em] text-white/50 group-hover:text-white/70">
          {section.action ?? "Deschide"}
          <ArrowRight className="size-3" />
        </span>
      </span>
    </button>
  );
}
