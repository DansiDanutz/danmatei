/**
 * ScheduleOversight — Admin calendar view of ALL schedule_events across trainers.
 *
 * Filterable by trainer, event kind, and date range.
 * Shows event details with trainer name, kind pill, and location.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Calendar, MapPin, User, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";

type EventRow = {
  id: string;
  title: string;
  kind: "training" | "match" | "tournament" | "other";
  starts_at: string;
  location: string | null;
  trainer_id: string;
  trainer: { profile: { full_name: string } } | null;
};

const KIND_LABEL: Record<string, string> = {
  training: "Antrenament",
  match: "Meci",
  tournament: "Turneu",
  other: "Altele",
};

const KIND_PILL: Record<string, string> = {
  training: "bg-emerald-300/10 text-emerald-300 border-emerald-300/20",
  match: "bg-amber-300/10 text-amber-300 border-amber-300/20",
  tournament: "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20",
  other: "bg-white/8 text-white/50 border-white/10",
};

export default function ScheduleOversight() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [trainers, setTrainers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterTrainer, setFilterTrainer] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [rangeDays, setRangeDays] = useState<number>(7);

  const load = async () => {
    setLoading(true);
    setError(null);

    const from = new Date(filterDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + rangeDays);
    to.setHours(23, 59, 59, 999);

    const { data, error: evErr } = await supabase
      .from("schedule_events")
      .select(
        "id, title, kind, starts_at, location, trainer_id, trainer:trainers(profile(full_name))"
      )
      .gte("starts_at", from.toISOString())
      .lte("starts_at", to.toISOString())
      .order("starts_at", { ascending: true });

    if (evErr) {
      setError(evErr.message);
      setLoading(false);
      return;
    }

    const raw = (data ?? []) as any[];
    const evs: EventRow[] = raw.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      starts_at: r.starts_at,
      location: r.location,
      trainer_id: r.trainer_id,
      trainer: r.trainer,
    }));
    setEvents(evs);

    // Trainer list from events
    const seen = new Set<string>();
    const list = evs
      .filter((e) => e.trainer?.profile?.full_name)
      .map((e) => ({
        id: e.trainer_id,
        full_name: e.trainer!.profile.full_name,
      }))
      .filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    setTrainers(list);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, rangeDays]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterTrainer !== "all" && e.trainer_id !== filterTrainer) return false;
      if (filterKind !== "all" && e.kind !== filterKind) return false;
      return true;
    });
  }, [events, filterTrainer, filterKind]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    filtered.forEach((e) => {
      const day = new Date(e.starts_at).toISOString().split("T")[0];
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const dayFmt = new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Bucharest",
  });

  const timeFmt = new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });

  return (
    <div className="grid gap-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-4">
        <div className="grid gap-1">
          <label className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/40">
            Dată de început
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 font-body text-sm text-white outline-none transition focus:border-brand-cyan/40"
          />
        </div>
        <div className="grid gap-1">
          <label className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/40">
            Interval (zile)
          </label>
          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 font-body text-sm text-white outline-none transition focus:border-brand-cyan/40"
          >
            <option value={3}>3 zile</option>
            <option value={7}>7 zile</option>
            <option value={14}>14 zile</option>
            <option value={30}>30 zile</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/40">
            Antrenor
          </label>
          <select
            value={filterTrainer}
            onChange={(e) => setFilterTrainer(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 font-body text-sm text-white outline-none transition focus:border-brand-cyan/40"
          >
            <option value="all">Toți</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/40">
            Tip
          </label>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 font-body text-sm text-white outline-none transition focus:border-brand-cyan/40"
          >
            <option value="all">Toate</option>
            <option value="training">Antrenamente</option>
            <option value="match">Meciuri</option>
            <option value="tournament">Turnee</option>
            <option value="other">Altele</option>
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2 font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-brand-cyan transition hover:bg-brand-cyan/20"
        >
          <Filter className="size-3" />
          Reîmprospătează
        </button>
      </div>

      {loading && (
        <div className="grid min-h-[20vh] place-items-center">
          <Loader2 className="size-5 animate-spin text-brand-cyan" />
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
          {error}
        </p>
      )}

      {!loading && grouped.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <Calendar className="mx-auto size-8 text-white/20" />
          <p className="mt-3 font-body text-sm text-white/50">
            Nu există evenimente în perioada selectată.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {grouped.map(([day, evs]) => (
          <section key={day}>
            <h3 className="mb-2 font-heading text-xs font-bold uppercase tracking-[0.1em] text-brand-cyan">
              {dayFmt.format(new Date(day))}
            </h3>
            <div className="grid gap-2">
              {evs.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
                >
                  <span
                    className={`rounded-full border px-2 py-0.5 font-heading text-[10px] uppercase tracking-[0.1em] ${KIND_PILL[e.kind]}`}
                  >
                    {KIND_LABEL[e.kind]}
                  </span>
                  <span className="font-heading text-sm font-semibold text-white">
                    {e.title}
                  </span>
                  <span className="ml-auto flex items-center gap-1 font-body text-xs text-white/50">
                    <Calendar className="size-3 text-white/40" />
                    {timeFmt.format(new Date(e.starts_at))}
                  </span>
                  {e.trainer?.profile?.full_name && (
                    <span className="flex items-center gap-1 font-body text-xs text-white/50">
                      <User className="size-3 text-white/40" />
                      {e.trainer.profile.full_name}
                    </span>
                  )}
                  {e.location && (
                    <span className="flex items-center gap-1 font-body text-xs text-white/50">
                      <MapPin className="size-3 text-white/40" />
                      {e.location}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
