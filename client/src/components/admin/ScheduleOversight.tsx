/**
 * ScheduleOversight — Admin calendar view of ALL schedule_events across trainers.
 *
 * Filterable by trainer, event kind, and date range.
 * Shows event details with trainer name, kind pill, and location.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarPlus,
  Filter,
  Loader2,
  MapPin,
  Save,
  Swords,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import WeeklyScheduleEditor from "@/components/trainer/WeeklyScheduleEditor";
import { TRAINING_BASES, OTHER_LOCATION } from "@/lib/locations";

type EventRow = {
  id: string;
  title: string;
  kind: "training" | "match" | "tournament" | "other";
  starts_at: string;
  location: string | null;
  opponent: string | null;
  trainer_id: string;
  trainer: { profile: { full_name: string } } | null;
};

type TrainerOption = {
  id: string;
  full_name: string;
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

const FIELD_CLS =
  "h-11 rounded-xl border border-white/15 bg-white/[0.04] px-3 font-body text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brand-cyan/50 focus:ring-2 focus:ring-brand-cyan/15";

function weekdayTone(dateKey: string): string {
  const weekday = new Date(`${dateKey}T12:00:00+02:00`).getDay();
  if (weekday === 1) return "text-sky-300";
  if (weekday === 3) return "text-rose-300";
  return "text-brand-gold";
}

function weekdayRule(dateKey: string): string {
  const weekday = new Date(`${dateKey}T12:00:00+02:00`).getDay();
  if (weekday === 1) return "from-sky-300/35";
  if (weekday === 3) return "from-rose-300/35";
  return "from-brand-gold/35";
}

export default function ScheduleOversight({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [filterTrainers, setFilterTrainers] = useState<TrainerOption[]>([]);
  const [scheduleTrainers, setScheduleTrainers] = useState<TrainerOption[]>([]);
  const [scheduleTrainerId, setScheduleTrainerId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterTrainer, setFilterTrainer] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [rangeDays, setRangeDays] = useState<number>(7);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = new Date(filterDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + rangeDays);
    to.setHours(23, 59, 59, 999);

    const [eventsResult, trainersResult] = await Promise.all([
      supabase
        .from("schedule_events")
        .select(
          "id, title, kind, starts_at, location, opponent, trainer_id, trainer:trainers(profile:profiles(full_name))"
        )
        .gte("starts_at", from.toISOString())
        .lte("starts_at", to.toISOString())
        .order("starts_at", { ascending: true }),
      supabase
        .from("trainers")
        .select(
          "id, display_order, profile:profiles!trainers_profile_id_fkey(full_name)"
        )
        .eq("active", true),
    ]);

    if (eventsResult.error || trainersResult.error) {
      setError(
        eventsResult.error?.message ??
          trainersResult.error?.message ??
          "Eroare la încărcarea programului."
      );
      setLoading(false);
      return;
    }

    const raw = (eventsResult.data ?? []) as any[];
    const evs: EventRow[] = raw.map(r => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      starts_at: r.starts_at,
      location: r.location,
      opponent: r.opponent,
      trainer_id: r.trainer_id,
      trainer: r.trainer,
    }));
    setEvents(evs);

    const activeOptions = ((trainersResult.data ?? []) as any[])
      .map(t => ({
        id: t.id,
        full_name: t.profile?.full_name ?? "Antrenor fără nume",
        display_order: Number(t.display_order ?? 999),
      }))
      .sort(
        (a, b) =>
          a.display_order - b.display_order ||
          a.full_name.localeCompare(b.full_name, "ro")
      )
      .map(({ id, full_name }) => ({ id, full_name }));

    const seen = new Set<string>();
    const eventOptions = evs
      .filter(e => e.trainer?.profile?.full_name)
      .map(e => ({
        id: e.trainer_id,
        full_name: e.trainer!.profile.full_name,
      }))
      .filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ro"));
    const merged = new Map(activeOptions.map(t => [t.id, t]));
    eventOptions.forEach(t => {
      if (!merged.has(t.id)) merged.set(t.id, t);
    });

    setScheduleTrainers(activeOptions);
    setFilterTrainers(Array.from(merged.values()));
    setScheduleTrainerId(current => {
      if (current && activeOptions.some(t => t.id === current)) return current;
      return activeOptions[0]?.id ?? "";
    });
    setFilterTrainer(current => {
      if (current === "all") return current;
      return merged.has(current) ? current : "all";
    });

    setLoading(false);
  }, [filterDate, rangeDays]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleMatchCreated = (localStartsAt: string) => {
    setFilterDate(localStartsAt.slice(0, 10));
    setFilterKind("match");
    void load();
  };

  const selectedScheduleTrainer = useMemo(
    () => scheduleTrainers.find(t => t.id === scheduleTrainerId) ?? null,
    [scheduleTrainerId, scheduleTrainers]
  );

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (filterTrainer !== "all" && e.trainer_id !== filterTrainer)
        return false;
      if (filterKind !== "all" && e.kind !== filterKind) return false;
      return true;
    });
  }, [events, filterTrainer, filterKind]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    filtered.forEach(e => {
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
      <AdminMatchForm
        trainerId={scheduleTrainerId}
        trainers={scheduleTrainers}
        disabled={loading || scheduleTrainers.length === 0}
        onTrainerChange={setScheduleTrainerId}
        onCreated={handleMatchCreated}
      />

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-heading text-[10px] font-bold uppercase tracking-[0.18em] text-brand-cyan">
              <CalendarPlus className="size-4" />
              Adaugă antrenamente
            </p>
            <h2 className="mt-1 font-heading text-xl font-bold text-white">
              Zile și ore pentru grupele active
            </h2>
          </div>
          <label className="grid min-w-[240px] gap-1">
            <span className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/40">
              Antrenor / grupă
            </span>
            <select
              value={scheduleTrainerId}
              onChange={e => setScheduleTrainerId(e.target.value)}
              disabled={scheduleTrainers.length === 0}
              className="h-11 rounded-xl border border-white/15 bg-white/[0.04] px-3 font-body text-sm text-white outline-none transition focus:border-brand-cyan/40 disabled:opacity-50"
            >
              {scheduleTrainers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {scheduleTrainerId ? (
          <WeeklyScheduleEditor
            key={scheduleTrainerId}
            trainerId={scheduleTrainerId}
            onChanged={() => {
              void load();
            }}
          />
        ) : !loading ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5">
            <p className="font-body text-sm text-white/55">
              Adaugă mai întâi un antrenor activ în tab-ul Antrenori.
            </p>
          </div>
        ) : null}

        {selectedScheduleTrainer && (
          <p className="font-body text-xs text-white/45">
            Calendarul se actualizează pentru{" "}
            {selectedScheduleTrainer.full_name} după fiecare schimbare.
          </p>
        )}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-4">
        <div className="grid gap-1">
          <label className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/40">
            Dată de început
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 font-body text-sm text-white outline-none transition focus:border-brand-cyan/40"
          />
        </div>
        <div className="grid gap-1">
          <label className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/40">
            Interval (zile)
          </label>
          <select
            value={rangeDays}
            onChange={e => setRangeDays(Number(e.target.value))}
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
            onChange={e => setFilterTrainer(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 font-body text-sm text-white outline-none transition focus:border-brand-cyan/40"
          >
            <option value="all">Toți</option>
            {filterTrainers.map(t => (
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
            onChange={e => setFilterKind(e.target.value)}
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
            Nu există evenimente în perioada selectată. Adaugă zile și ore mai
            sus, apoi apasă Reîmprospătează.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {grouped.map(([day, evs]) => (
          <section key={day}>
            <div className="mb-2 flex items-center gap-3">
              <h3
                className={`font-heading text-xs font-bold uppercase tracking-[0.1em] ${weekdayTone(day)}`}
              >
                {dayFmt.format(new Date(day))}
              </h3>
              <span
                className={`h-px flex-1 bg-gradient-to-r ${weekdayRule(day)} via-white/10 to-transparent`}
              />
            </div>
            <div className="grid gap-2">
              {evs.map(e => (
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
                  {e.opponent && (
                    <span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[0.06] px-2 py-0.5 font-body text-xs text-brand-cyan/85">
                      vs {e.opponent}
                    </span>
                  )}
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

function AdminMatchForm({
  trainerId,
  trainers,
  disabled,
  onTrainerChange,
  onCreated,
}: {
  trainerId: string;
  trainers: TrainerOption[];
  disabled: boolean;
  onTrainerChange: (trainerId: string) => void;
  onCreated: (localStartsAt: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [opponent, setOpponent] = useState("");
  const [locChoice, setLocChoice] = useState<string>(TRAINING_BASES[0]);
  const [customLoc, setCustomLoc] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedTrainer = trainers.find(t => t.id === trainerId) ?? null;

  const submit = async () => {
    if (!trainerId) {
      toast.error("Alege un antrenor activ pentru meci.");
      return;
    }
    if (!startsAt) {
      toast.error("Alege data și ora meciului.");
      return;
    }

    const cleanOpponent = opponent.trim();
    const cleanTitle =
      title.trim() || (cleanOpponent ? `Meci vs ${cleanOpponent}` : "Meci");
    const location =
      locChoice === OTHER_LOCATION ? customLoc.trim() || null : locChoice;

    setSaving(true);
    const { error } = await supabase.from("schedule_events").insert({
      trainer_id: trainerId,
      kind: "match",
      title: cleanTitle,
      starts_at: new Date(startsAt).toISOString(),
      location,
      opponent: cleanOpponent || null,
      notes: notes.trim() || null,
      approval_status: "approved",
    });
    setSaving(false);

    if (error) {
      toast.error("Nu am putut adăuga meciul", { description: error.message });
      return;
    }

    setTitle("");
    setStartsAt("");
    setOpponent("");
    setNotes("");
    setCustomLoc("");
    toast.success("Meci adăugat", {
      description: selectedTrainer
        ? `Apare la Program și la Meciuri pentru ${selectedTrainer.full_name}.`
        : "Apare în Program și în Meciuri.",
    });
    onCreated(startsAt);
  };

  return (
    <section className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.05] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-heading text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/90">
            <Swords className="size-4" />
            Adaugă meci
          </p>
          <h2 className="mt-1 font-heading text-xl font-bold text-white">
            Meci nou pentru grupa selectată
          </h2>
        </div>
        {selectedTrainer && (
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 font-heading text-[10px] uppercase tracking-[0.14em] text-amber-100/85">
            {selectedTrainer.full_name}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.1fr_1fr_1fr]">
        <label className="grid gap-1">
          <span className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/45">
            Antrenor / grupă
          </span>
          <select
            value={trainerId}
            onChange={e => onTrainerChange(e.target.value)}
            className={FIELD_CLS}
            disabled={disabled || saving}
          >
            {trainers.map(trainer => (
              <option key={trainer.id} value={trainer.id}>
                {trainer.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/45">
            Titlu
          </span>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Meci amical"
            className={FIELD_CLS}
            disabled={disabled || saving}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/45">
            Dată și oră
          </span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={e => setStartsAt(e.target.value)}
            className={FIELD_CLS}
            disabled={disabled || saving}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/45">
            Adversar
          </span>
          <input
            type="text"
            value={opponent}
            onChange={e => setOpponent(e.target.value)}
            placeholder="ACS Sănătatea"
            className={FIELD_CLS}
            disabled={disabled || saving}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1">
          <span className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/45">
            Locație
          </span>
          <select
            value={locChoice}
            onChange={e => setLocChoice(e.target.value)}
            className={FIELD_CLS}
            disabled={disabled || saving}
          >
            {TRAINING_BASES.map(base => (
              <option key={base} value={base}>
                {base}
              </option>
            ))}
            <option value={OTHER_LOCATION}>{OTHER_LOCATION}</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-heading text-[10px] uppercase tracking-[0.1em] text-white/45">
            Note
          </span>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="ex. convocare 17:00"
            className={FIELD_CLS}
            disabled={disabled || saving}
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || saving}
          className="mt-5 inline-flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 font-heading text-[10px] font-bold uppercase tracking-[0.14em] text-[oklch(0.11_0.03_250)] transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-55 lg:mt-auto"
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Salvează meciul
        </button>
      </div>

      {locChoice === OTHER_LOCATION && (
        <input
          type="text"
          value={customLoc}
          onChange={e => setCustomLoc(e.target.value)}
          placeholder="Scrie locația…"
          className={`${FIELD_CLS} mt-3 w-full`}
          disabled={disabled || saving}
        />
      )}
    </section>
  );
}
