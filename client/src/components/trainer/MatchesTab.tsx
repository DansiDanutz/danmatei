/**
 * MatchesTab — Trainer match result entry + participation tracking.
 *
 * Lists all schedule_events of kind='match' for this trainer.
 * Trainers can enter/edit:
 *   - match result (our_score, opponent_score, recap)
 *   - player participations (role, goals, assists) per child in their group
 */
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Trophy,
  Swords,
  Save,
  ChevronDown,
  ChevronUp,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Types ───────────────────────────────────────────────────────────────────

type Child = {
  id: string;
  full_name: string;
};

type MatchEvent = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  opponent: string | null;
  notes: string | null;
};

type MatchResult = {
  event_id: string;
  our_score: number;
  opponent_score: number;
  recap_md: string | null;
};

type Participation = {
  id: string;
  child_id: string;
  child_name: string;
  role: string;
  goals: number;
  assists: number;
  notes: string | null;
};

// ── Zod schemas ─────────────────────────────────────────────────────────────

const resultSchema = z.object({
  ourScore: z.number().min(0).int(),
  opponentScore: z.number().min(0).int(),
  recap: z.string().max(2000).optional().or(z.literal("")),
});
type ResultValues = z.infer<typeof resultSchema>;

// ── Component ───────────────────────────────────────────────────────────────

export default function MatchesTab({
  trainerId,
  children,
}: {
  trainerId: string;
  children: Child[];
}) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [resultsMap, setResultsMap] = useState<Map<string, MatchResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: evData, error: evErr } = await supabase
      .from("schedule_events")
      .select("id, title, starts_at, location, opponent, notes")
      .eq("trainer_id", trainerId)
      .eq("kind", "match")
      .order("starts_at", { ascending: false });

    if (evErr) {
      setError(evErr.message);
      setLoading(false);
      return;
    }

    const evs = (evData ?? []) as MatchEvent[];
    setEvents(evs);

    if (evs.length > 0) {
      const eventIds = evs.map((e) => e.id);
      const { data: resData } = await supabase
        .from("match_results")
        .select("event_id, our_score, opponent_score, recap_md")
        .in("event_id", eventIds);

      const map = new Map<string, MatchResult>();
      (resData ?? []).forEach((r: MatchResult) => map.set(r.event_id, r));
      setResultsMap(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  if (loading) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Loader2 className="size-5 animate-spin text-brand-cyan" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
        {error}
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <Swords className="mx-auto size-8 text-white/20" />
        <p className="mt-3 font-body text-sm text-white/50">
          Nu ai meciuri programate încă. Creează un eveniment de tip „Meci" din tab-ul Program.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {events.map((ev) => {
        const result = resultsMap.get(ev.id);
        const isEditing = editingEventId === ev.id;
        const isPast = new Date(ev.starts_at) < new Date();

        return (
          <article
            key={ev.id}
            className="overflow-hidden rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70"
          >
            {/* Match header */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Swords className="size-4 text-brand-gold" />
                  <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.04em] text-white">
                    {ev.title}
                  </h3>
                </div>
                <p className="mt-1 font-body text-xs text-white/50">
                  {new Date(ev.starts_at).toLocaleString("ro-RO", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Bucharest",
                  })}
                  {ev.location && ` · ${ev.location}`}
                </p>
                {ev.opponent && (
                  <p className="mt-0.5 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan/80">
                    Adversar: {ev.opponent}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {result ? (
                  <span className="flex items-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1.5">
                    <Trophy className="size-3.5 text-brand-gold" />
                    <span className="font-heading text-sm font-bold tabular-nums text-brand-cyan">
                      {result.our_score}
                    </span>
                    <span className="text-white/30">·</span>
                    <span className="font-heading text-sm font-bold tabular-nums text-white/70">
                      {result.opponent_score}
                    </span>
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-heading text-[10px] uppercase tracking-[0.16em] text-white/45">
                    Fără rezultat
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setEditingEventId(isEditing ? null : ev.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
                >
                  {isEditing ? (
                    <>
                      <ChevronUp className="size-3" />
                      Închide
                    </>
                  ) : result ? (
                    <>
                      <Pencil className="size-3" />
                      Editează
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3" />
                      Adaugă rezultat
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Expandable form */}
            {isEditing && (
              <MatchEditor
                eventId={ev.id}
                children={children}
                existingResult={result ?? null}
                onSaved={() => {
                  setEditingEventId(null);
                  load();
                }}
                onCancel={() => setEditingEventId(null)}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}

// ── Match Editor (result + participations) ──────────────────────────────────

function MatchEditor({
  eventId,
  children,
  existingResult,
  onSaved,
  onCancel,
}: {
  eventId: string;
  children: Child[];
  existingResult: MatchResult | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [partLoaded, setPartLoaded] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResultValues>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      ourScore: existingResult?.our_score ?? 0,
      opponentScore: existingResult?.opponent_score ?? 0,
      recap: existingResult?.recap_md ?? "",
    },
  });

  // Load existing participations
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("match_participations")
        .select("id, child_id, role, goals, assists, notes")
        .eq("event_id", eventId);

      if (cancelled) return;

      const existing = (data ?? []) as Omit<Participation, "child_name">[];
      const existingMap = new Map(existing.map((p) => [p.child_id, p]));

      // Build full list: every child in group gets a row
      const full: Participation[] = children.map((c) => {
        const e = existingMap.get(c.id);
        return {
          id: e?.id ?? "",
          child_id: c.id,
          child_name: c.full_name,
          role: e?.role ?? "starter",
          goals: e?.goals ?? 0,
          assists: e?.assists ?? 0,
          notes: e?.notes ?? "",
        };
      });

      setParticipations(full);
      setPartLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, children]);

  const updatePart = (
    childId: string,
    field: keyof Participation,
    value: string | number
  ) => {
    setParticipations((prev) =>
      prev.map((p) => (p.child_id === childId ? { ...p, [field]: value } : p))
    );
  };

  const onSubmit = handleSubmit(async (v) => {
    setSaving(true);
    setServerError(null);

    try {
      // 1. Upsert match result
      const scorers = participations
        .filter((p) => p.goals > 0)
        .map((p) => ({ child_id: p.child_id, goals: p.goals, name: p.child_name }));

      const { error: resErr } = await supabase.from("match_results").upsert(
        {
          event_id: eventId,
          our_score: v.ourScore,
          opponent_score: v.opponentScore,
          recap_md: v.recap || null,
          scorers,
        },
        { onConflict: "event_id" }
      );

      if (resErr) throw resErr;

      // 2. Upsert participations
      for (const p of participations) {
        const { error: partErr } = await supabase
          .from("match_participations")
          .upsert(
            {
              event_id: eventId,
              child_id: p.child_id,
              role: p.role,
              goals: p.goals,
              assists: p.assists,
              notes: p.notes || null,
            },
            { onConflict: "event_id, child_id" }
          );
        if (partErr) throw partErr;
      }

      onSaved();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  });

  if (!partLoaded) {
    return (
      <div className="border-t border-white/5 p-4">
        <Loader2 className="size-4 animate-spin text-brand-cyan" />
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-white/5 p-4 sm:p-5"
    >
      {/* Score row */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            Goluri noastre
          </label>
          <input
            type="number"
            min={0}
            {...register("ourScore", { valueAsNumber: true })}
            className="w-20 rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 text-center font-heading text-lg font-bold text-brand-cyan focus:border-brand-cyan/60"
          />
          {errors.ourScore && (
            <p className="mt-1 font-body text-xs text-rose-300/85">
              {errors.ourScore.message}
            </p>
          )}
        </div>
        <span className="pb-2 font-heading text-xl text-white/30">·</span>
        <div>
          <label className="mb-1 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            Goluri adversar
          </label>
          <input
            type="number"
            min={0}
            {...register("opponentScore", { valueAsNumber: true })}
            className="w-20 rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 text-center font-heading text-lg font-bold text-white/70 focus:border-brand-cyan/60"
          />
          {errors.opponentScore && (
            <p className="mt-1 font-body text-xs text-rose-300/85">
              {errors.opponentScore.message}
            </p>
          )}
        </div>
      </div>

      {/* Recap */}
      <div className="mt-4">
        <label className="mb-1 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
          Rezumat meci
        </label>
        <textarea
          rows={2}
          {...register("recap")}
          placeholder="Descriere scurtă a meciului…"
          className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
        />
      </div>

      {/* Player participations */}
      <div className="mt-5">
        <h4 className="font-heading text-[11px] uppercase tracking-[0.18em] text-white/55">
          Prezență & statistici jucători
        </h4>
        <div className="mt-3 grid gap-2">
          {participations.map((p) => (
            <div
              key={p.child_id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
            >
              <span className="min-w-[8rem] font-heading text-sm font-semibold text-white">
                {p.child_name}
              </span>

              <select
                value={p.role}
                onChange={(e) => updatePart(p.child_id, "role", e.target.value)}
                className="rounded-lg border border-white/10 bg-[oklch(0.10_0.02_250)] px-2 py-1 font-body text-xs text-white"
              >
                <option value="starter">Titular</option>
                <option value="sub">Rezervă</option>
                <option value="injured">Accidentat</option>
                <option value="absent">Absent</option>
              </select>

              <div className="flex items-center gap-1">
                <span className="font-body text-[10px] text-white/40">Goluri</span>
                <input
                  type="number"
                  min={0}
                  value={p.goals}
                  onChange={(e) =>
                    updatePart(p.child_id, "goals", parseInt(e.target.value) || 0)
                  }
                  className="w-12 rounded-lg border border-white/10 bg-[oklch(0.10_0.02_250)] px-1 py-1 text-center font-heading text-xs text-white"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="font-body text-[10px] text-white/40">Pase</span>
                <input
                  type="number"
                  min={0}
                  value={p.assists}
                  onChange={(e) =>
                    updatePart(p.child_id, "assists", parseInt(e.target.value) || 0)
                  }
                  className="w-12 rounded-lg border border-white/10 bg-[oklch(0.10_0.02_250)] px-1 py-1 text-center font-heading text-xs text-white"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {serverError && (
        <p className="mt-4 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
          {serverError}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <Save className="size-3.5" />
              Salvează rezultatul
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-heading text-[11px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:text-white"
        >
          Anulează
        </button>
      </div>
    </form>
  );
}
