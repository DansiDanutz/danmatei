/**
 * ScheduleCalendar — compact month grid of the trainer's events.
 * Monday-start weeks; events are dotted/labelled per day and coloured by kind.
 * Tapping a day calls onSelectDay so the parent can scroll to / highlight it.
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CalEvent = {
  id: string;
  kind: "training" | "match" | "tournament" | "other";
  title: string;
  starts_at: string;
  cancelled_at: string | null;
};

const MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];
const WEEKDAYS = ["L", "Ma", "Mi", "J", "V", "S", "D"];

const KIND_DOT: Record<CalEvent["kind"], string> = {
  training: "bg-brand-cyan",
  match: "bg-rose-400",
  tournament: "bg-amber-400",
  other: "bg-white/50",
};

/** Local YYYY-MM-DD (browser tz = Europe/Bucharest for the academy's users). */
function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ScheduleCalendar({
  events,
  onSelectDay,
}: {
  events: CalEvent[];
  onSelectDay?: (dayKey: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const k = localKey(new Date(e.starts_at));
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    // Monday-start offset (getDay: 0=Sun..6=Sat → 0=Mon..6=Sun)
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(cursor.y, cursor.m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const todayKey = localKey(new Date());
  const step = (delta: number) => {
    const m = cursor.m + delta;
    setCursor({ y: cursor.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  return (
    <div className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold uppercase tracking-[0.06em] text-white">
          {MONTHS[cursor.m]} {cursor.y}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Luna anterioară"
            className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 hover:text-brand-cyan"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor({ y: new Date().getFullYear(), m: new Date().getMonth() })}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-white/70 hover:text-brand-cyan"
          >
            Azi
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Luna următoare"
            className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 hover:text-brand-cyan"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center font-heading text-[9px] uppercase tracking-[0.12em] text-white/35"
          >
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const key = localKey(d);
          const inMonth = d.getMonth() === cursor.m;
          const isToday = key === todayKey;
          const dayEvents = byDay.get(key) ?? [];
          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelectDay?.(key)}
              className={`flex min-h-[64px] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors ${
                isToday
                  ? "border-brand-cyan/50 bg-brand-cyan/[0.06]"
                  : "border-white/8 bg-white/[0.02] hover:border-white/15"
              } ${inMonth ? "" : "opacity-35"}`}
            >
              <span
                className={`font-heading text-[11px] tabular-nums ${
                  isToday ? "text-brand-cyan" : "text-white/60"
                }`}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    title={e.title}
                    className={`flex items-center gap-1 truncate font-heading text-[8.5px] uppercase tracking-[0.04em] ${
                      e.cancelled_at ? "text-white/30 line-through" : "text-white/75"
                    }`}
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${KIND_DOT[e.kind]} ${
                        e.cancelled_at ? "opacity-40" : ""
                      }`}
                    />
                    <span className="truncate">{e.title}</span>
                  </span>
                ))}
                {dayEvents.length > 2 && (
                  <span className="font-heading text-[8px] uppercase tracking-[0.1em] text-white/40">
                    +{dayEvents.length - 2}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-white/8 pt-3">
        {(
          [
            ["training", "Antrenament"],
            ["match", "Meci"],
            ["tournament", "Turneu"],
            ["other", "Altul"],
          ] as const
        ).map(([k, label]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 font-heading text-[9px] uppercase tracking-[0.12em] text-white/45"
          >
            <span className={`size-2 rounded-full ${KIND_DOT[k]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
