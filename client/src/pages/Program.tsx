/**
 * /program — Public weekly schedule. Pulls upcoming `schedule_events`
 * (training + match + tournament) for the next 14 days, grouped by day.
 * Falls back to the static training grid when the DB is empty.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Dumbbell, MapPin, Swords, Trophy } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { supabase } from "@/lib/supabase";
import { expoOut } from "@/lib/motion";

type Kind = "training" | "match" | "tournament" | "other";

interface EventRow {
  id: string;
  kind: Kind;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  opponent: string | null;
}

const FALLBACK: EventRow[] = (() => {
  const now = Date.now();
  return [
    {
      id: "demo-1",
      kind: "training",
      title: "Antrenament U7–U9",
      starts_at: new Date(now + 86400000).toISOString(),
      ends_at: new Date(now + 86400000 + 60 * 60 * 1000).toISOString(),
      location: "Baza Sportivă Mănăștur",
      opponent: null,
    },
    {
      id: "demo-2",
      kind: "training",
      title: "Antrenament U10–U13",
      starts_at: new Date(now + 86400000 + 60 * 60 * 1000).toISOString(),
      ends_at: new Date(now + 86400000 + 2.5 * 60 * 60 * 1000).toISOString(),
      location: "Baza Sportivă Mănăștur",
      opponent: null,
    },
    {
      id: "demo-3",
      kind: "match",
      title: "U13 vs ACS Sănătatea",
      starts_at: new Date(now + 5 * 86400000).toISOString(),
      ends_at: new Date(now + 5 * 86400000 + 90 * 60 * 1000).toISOString(),
      location: "Stadion Cetatea",
      opponent: "ACS Sănătatea",
    },
    {
      id: "demo-4",
      kind: "tournament",
      title: "Cupa Transilvaniei — U11",
      starts_at: new Date(now + 12 * 86400000).toISOString(),
      ends_at: null,
      location: "Cluj Arena",
      opponent: null,
    },
  ];
})();

const dayFormatter = new Intl.DateTimeFormat("ro-RO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("ro-RO", {
  hour: "2-digit",
  minute: "2-digit",
});

const KIND_META: Record<
  Kind,
  { label: string; icon: typeof Dumbbell; tone: string }
> = {
  training: { label: "Antrenament", icon: Dumbbell, tone: "text-brand-cyan" },
  match: { label: "Meci", icon: Swords, tone: "text-brand-gold" },
  tournament: { label: "Turneu", icon: Trophy, tone: "text-brand-gold" },
  other: { label: "Eveniment", icon: Calendar, tone: "text-white/70" },
};

export default function Program() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const horizon = new Date(Date.now() + 14 * 86400000).toISOString();
    void (async () => {
      const { data } = await supabase
        .from("schedule_events")
        .select("id, kind, title, starts_at, ends_at, location, opponent")
        .gte("starts_at", new Date().toISOString())
        .lte("starts_at", horizon)
        .order("starts_at", { ascending: true })
        .limit(60);
      if (cancelled) return;
      const rows = (data as EventRow[] | null) ?? [];
      setEvents(rows.length === 0 ? FALLBACK : rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const days = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const ev of events) {
      const key = dayFormatter.format(new Date(ev.starts_at));
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <PublicShell
      pageKicker="Program"
      pageTitle="Săptămâna următoare"
      pageDescription="Antrenamente, meciuri și turnee planificate pentru toate grupele."
    >
      {loading && (
        <div className="grid place-items-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      )}

      <div className="grid gap-6">
        {days.map(([day, list], di) => (
          <motion.section
            key={day}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: di * 0.06, ease: expoOut }}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="font-heading text-[11px] uppercase tracking-[0.22em] text-brand-cyan">
                {day}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-brand-cyan/30 via-white/10 to-transparent" />
              <span className="font-heading text-[10px] tabular-nums uppercase tracking-[0.18em] text-white/40">
                {list.length} {list.length === 1 ? "eveniment" : "evenimente"}
              </span>
            </div>
            <ul className="grid gap-3">
              {list.map(ev => {
                const meta = KIND_META[ev.kind] ?? KIND_META.other;
                const Icon = meta.icon;
                const start = timeFormatter.format(new Date(ev.starts_at));
                const end = ev.ends_at
                  ? timeFormatter.format(new Date(ev.ends_at))
                  : null;
                return (
                  <li
                    key={ev.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/55 p-4 transition-colors hover:border-brand-cyan/40"
                  >
                    <span
                      className={`grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] ${meta.tone}`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-heading text-base font-semibold uppercase tracking-[0.04em] text-white sm:text-lg">
                        {ev.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[12px] text-white/55">
                        <span
                          className={`uppercase tracking-[0.16em] ${meta.tone}`}
                        >
                          {meta.label}
                        </span>
                        {ev.location && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="size-3.5 text-brand-cyan/70" />
                            {ev.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-heading text-sm tabular-nums text-white">
                      <div>{start}</div>
                      {end && <div className="text-white/45">– {end}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        ))}
      </div>

      {!loading && events.length === 0 && (
        <p className="py-12 text-center font-body text-sm text-white/45">
          Nu sunt evenimente planificate în următoarele două săptămâni.
        </p>
      )}
    </PublicShell>
  );
}
