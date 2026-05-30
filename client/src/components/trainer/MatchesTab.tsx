/**
 * MatchesTab — the trainer's match centre.
 *
 * For every schedule_event of kind='match' the trainer can:
 *   1. Build the MATCH SQUAD — call up players from their own group AND, by
 *      searching the whole academy by name, guest players from other groups
 *      (/api/academy/players). The squad is fotbal.match_participations.
 *   2. Enter the result (score + recap) and per-player stats (goals/assists),
 *      scoped to the squad — not the whole group.
 *   3. Notify the SQUAD's parents (/api/schedule/notify → for matches this
 *      fans out only to the called-up players, not the whole group).
 *
 * The squad is loaded from /api/match/squad because RLS hides guest players
 * from other groups from the trainer's own client.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Search,
  Plus,
  X,
  Megaphone,
  CheckCircle2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import ProposedMatchesQueue from "./ProposedMatchesQueue";
import MatchPhotos from "./MatchPhotos";

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
  group_notified_at: string | null;
};

type MatchResult = {
  event_id: string;
  our_score: number;
  opponent_score: number;
  recap_md: string | null;
};

type SquadMember = {
  childId: string;
  name: string;
  role: string;
  goals: number;
  assists: number;
  groupLabel: string | null;
  yearOfBirth: number | null;
};

type AcademyPlayer = {
  id: string;
  name: string;
  yearOfBirth: number | null;
  groupLabel: string | null;
};

// ── Zod schema (result) ──────────────────────────────────────────────────────

const resultSchema = z.object({
  ourScore: z.number().min(0).int(),
  opponentScore: z.number().min(0).int(),
  recap: z.string().max(2000).optional().or(z.literal("")),
});
type ResultValues = z.infer<typeof resultSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    "content-type": "application/json",
    authorization: `Bearer ${data.session?.access_token ?? ""}`,
  };
}

const ROLE_LABEL: Record<string, string> = {
  starter: "Titular",
  sub: "Rezervă",
  injured: "Accidentat",
  absent: "Absent",
};

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: evData, error: evErr } = await supabase
      .from("schedule_events")
      .select("id, title, starts_at, location, opponent, notes, group_notified_at")
      .eq("trainer_id", trainerId)
      .eq("kind", "match")
      .eq("approval_status", "approved")
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
  }, [trainerId]);

  useEffect(() => {
    load();
  }, [load]);

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
      <div className="grid gap-4">
        <ProposedMatchesQueue trainerId={trainerId} onChanged={load} />
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <Swords className="mx-auto size-8 text-white/20" />
          <p className="mt-3 font-body text-sm text-white/50">
            Nu ai meciuri programate încă. Creează un eveniment de tip „Meci” din
            tab-ul Program, apoi construiește echipa aici.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ProposedMatchesQueue trainerId={trainerId} onChanged={load} />
      {events.map((ev) => {
        const result = resultsMap.get(ev.id);
        const isEditing = editingEventId === ev.id;

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
                  {ev.group_notified_at && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.14em] text-emerald-200">
                      <CheckCircle2 className="size-2.5" />
                      Echipă notificată
                    </span>
                  )}
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
                  ) : (
                    <>
                      <ChevronDown className="size-3" />
                      Echipă & rezultat
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Expandable editor */}
            {isEditing && (
              <MatchEditor
                eventId={ev.id}
                ownGroup={children}
                groupNotifiedAt={ev.group_notified_at}
                existingResult={result ?? null}
                onSaved={() => {
                  setEditingEventId(null);
                  load();
                }}
                onNotified={load}
                onCancel={() => setEditingEventId(null)}
              />
            )}
            {result && !isEditing && <MatchPhotos eventId={ev.id} />}
          </article>
        );
      })}
    </div>
  );
}

// ── Match Editor (squad + result + stats) ────────────────────────────────────

function MatchEditor({
  eventId,
  ownGroup,
  groupNotifiedAt,
  existingResult,
  onSaved,
  onNotified,
  onCancel,
}: {
  eventId: string;
  ownGroup: Child[];
  groupNotifiedAt: string | null;
  existingResult: MatchResult | null;
  onSaved: () => void;
  onNotified: () => void;
  onCancel: () => void;
}) {
  const [squad, setSquad] = useState<SquadMember[]>([]);
  const [squadLoaded, setSquadLoaded] = useState(false);
  const [busyChild, setBusyChild] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const squadIds = useMemo(() => new Set(squad.map((s) => s.childId)), [squad]);
  const ownGroupIds = useMemo(
    () => new Set(ownGroup.map((c) => c.id)),
    [ownGroup]
  );
  const guests = useMemo(
    () => squad.filter((s) => !ownGroupIds.has(s.childId)),
    [squad, ownGroupIds]
  );

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

  const loadSquad = useCallback(async () => {
    const r = await fetch(`/api/match/squad?eventId=${eventId}`, {
      headers: await authHeaders(),
    });
    if (!r.ok) {
      setSquadLoaded(true);
      return;
    }
    const j = (await r.json()) as { squad: SquadMember[] };
    setSquad(
      (j.squad ?? []).map((s) => ({
        childId: s.childId,
        name: s.name,
        role: s.role || "starter",
        goals: s.goals ?? 0,
        assists: s.assists ?? 0,
        groupLabel: s.groupLabel ?? null,
        yearOfBirth: s.yearOfBirth ?? null,
      }))
    );
    setSquadLoaded(true);
  }, [eventId]);

  useEffect(() => {
    loadSquad();
  }, [loadSquad]);

  // ── Squad membership (immediate, optimistic) ──────────────────────────────

  const addToSquad = async (
    member: Omit<SquadMember, "role" | "goals" | "assists">
  ) => {
    if (squadIds.has(member.childId)) return;
    setBusyChild(member.childId);
    setSquad((prev) => [
      ...prev,
      { ...member, role: "starter", goals: 0, assists: 0 },
    ]);
    const { error } = await supabase.from("match_participations").insert({
      event_id: eventId,
      child_id: member.childId,
      role: "starter",
      goals: 0,
      assists: 0,
    });
    setBusyChild(null);
    if (error) {
      toast.error("Nu am putut adăuga jucătorul", { description: error.message });
      await loadSquad();
    }
  };

  const removeFromSquad = async (childId: string) => {
    setBusyChild(childId);
    setSquad((prev) => prev.filter((s) => s.childId !== childId));
    const { error } = await supabase
      .from("match_participations")
      .delete()
      .eq("event_id", eventId)
      .eq("child_id", childId);
    setBusyChild(null);
    if (error) {
      toast.error("Nu am putut scoate jucătorul", { description: error.message });
      await loadSquad();
    }
  };

  const updateMember = (
    childId: string,
    field: "role" | "goals" | "assists",
    value: string | number
  ) => {
    setSquad((prev) =>
      prev.map((s) => (s.childId === childId ? { ...s, [field]: value } : s))
    );
  };

  // ── Save result + stats ───────────────────────────────────────────────────

  const onSubmit = handleSubmit(async (v) => {
    setSaving(true);
    setServerError(null);
    try {
      const scorers = squad
        .filter((s) => s.goals > 0)
        .map((s) => ({ child_id: s.childId, goals: s.goals, name: s.name }));

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

      for (const s of squad) {
        const { error: partErr } = await supabase
          .from("match_participations")
          .upsert(
            {
              event_id: eventId,
              child_id: s.childId,
              role: s.role,
              goals: s.goals,
              assists: s.assists,
            },
            { onConflict: "event_id, child_id" }
          );
        if (partErr) throw partErr;
      }

      toast.success("Rezultat salvat");
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare la salvare.";
      setServerError(msg);
      toast.error("Salvarea a eșuat", { description: msg });
    } finally {
      setSaving(false);
    }
  });

  // ── Notify the squad ──────────────────────────────────────────────────────

  const notifySquad = async () => {
    if (squad.length === 0) {
      toast.error("Adaugă jucători în echipă înainte de a notifica.");
      return;
    }
    setNotifying(true);
    try {
      const r = await fetch("/api/schedule/notify", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ eventId }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        notified?: number;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? `API ${r.status}`);
      toast.success(
        `Echipă notificată — ${j.notified ?? 0} ${
          (j.notified ?? 0) === 1 ? "părinte" : "părinți"
        }.`
      );
      onNotified();
    } catch (e) {
      toast.error("Notificarea a eșuat", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setNotifying(false);
    }
  };

  if (!squadLoaded) {
    return (
      <div className="border-t border-white/5 p-4">
        <Loader2 className="size-4 animate-spin text-brand-cyan" />
      </div>
    );
  }

  return (
    <div className="border-t border-white/5 p-4 sm:p-5">
      {/* ── SQUAD ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.18em] text-white/55">
            <Users className="size-3.5 text-brand-cyan" />
            Echipa meciului
            <span className="rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-2 py-0.5 text-brand-cyan">
              {squad.length}
            </span>
          </h4>
          <button
            type="button"
            onClick={notifySquad}
            disabled={notifying || squad.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-brand-gold transition-colors hover:bg-brand-gold/20 disabled:opacity-40"
          >
            {notifying ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Megaphone className="size-3" />
            )}
            {groupNotifiedAt ? "Renotifică echipa" : "Notifică echipa"}
          </button>
        </div>

        {/* Own group — the whole roster; tap to call up / drop */}
        <p className="mt-3 font-heading text-[10px] uppercase tracking-[0.16em] text-white/40">
          Grupa mea ({ownGroup.length})
        </p>
        {ownGroup.length === 0 ? (
          <p className="mt-1 font-body text-xs text-white/40">
            Niciun copil activ în grupă.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {ownGroup.map((c) => {
              const inSquad = squadIds.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={busyChild === c.id}
                  onClick={() =>
                    inSquad
                      ? removeFromSquad(c.id)
                      : addToSquad({
                          childId: c.id,
                          name: c.full_name,
                          groupLabel: null,
                          yearOfBirth: null,
                        })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-[11px] tracking-[0.02em] transition-colors disabled:opacity-50 ${
                    inSquad
                      ? "border-brand-cyan/50 bg-brand-cyan/15 text-brand-cyan"
                      : "border-white/12 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {inSquad ? (
                    <CheckCircle2 className="size-3" />
                  ) : (
                    <Plus className="size-3" />
                  )}
                  {c.full_name}
                </button>
              );
            })}
          </div>
        )}

        {/* Guests from other groups */}
        {guests.length > 0 && (
          <>
            <p className="mt-4 font-heading text-[10px] uppercase tracking-[0.16em] text-white/40">
              Invitați din academie ({guests.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {guests.map((g) => (
                <span
                  key={g.childId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1.5 font-heading text-[11px] text-brand-gold"
                >
                  {g.name}
                  {g.groupLabel && (
                    <span className="text-brand-gold/60">· {g.groupLabel}</span>
                  )}
                  <button
                    type="button"
                    disabled={busyChild === g.childId}
                    onClick={() => removeFromSquad(g.childId)}
                    className="ml-0.5 grid size-4 place-items-center rounded-full hover:bg-brand-gold/20 disabled:opacity-50"
                    aria-label={`Scoate ${g.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </>
        )}

        {/* Academy-wide search to add guests */}
        <AcademySearch
          excludeIds={squadIds}
          onAdd={(p) =>
            addToSquad({
              childId: p.id,
              name: p.name,
              groupLabel: p.groupLabel,
              yearOfBirth: p.yearOfBirth,
            })
          }
        />
      </section>

      {/* ── RESULT ────────────────────────────────────────────────────────── */}
      <form onSubmit={onSubmit} className="mt-6 border-t border-white/8 pt-5">
        <h4 className="font-heading text-[11px] uppercase tracking-[0.18em] text-white/55">
          Rezultat
        </h4>
        <div className="mt-3 flex flex-wrap items-end gap-4">
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

        {/* Per-squad stats */}
        <div className="mt-5">
          <h4 className="font-heading text-[11px] uppercase tracking-[0.18em] text-white/55">
            Statistici jucători
          </h4>
          {squad.length === 0 ? (
            <p className="mt-2 font-body text-xs text-white/40">
              Construiește echipa mai sus pentru a înregistra statistici.
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {squad.map((p) => (
                <div
                  key={p.childId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <span className="min-w-[8rem] font-heading text-sm font-semibold text-white">
                    {p.name}
                    {!ownGroupIds.has(p.childId) && (
                      <span className="ml-1 font-heading text-[9px] uppercase tracking-[0.12em] text-brand-gold/80">
                        invitat
                      </span>
                    )}
                  </span>

                  <select
                    value={p.role}
                    onChange={(e) => updateMember(p.childId, "role", e.target.value)}
                    className="rounded-lg border border-white/10 bg-[oklch(0.10_0.02_250)] px-2 py-1 font-body text-xs text-white"
                  >
                    {Object.entries(ROLE_LABEL).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1">
                    <span className="font-body text-[10px] text-white/40">Goluri</span>
                    <input
                      type="number"
                      min={0}
                      value={p.goals}
                      onChange={(e) =>
                        updateMember(p.childId, "goals", parseInt(e.target.value) || 0)
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
                        updateMember(p.childId, "assists", parseInt(e.target.value) || 0)
                      }
                      className="w-12 rounded-lg border border-white/10 bg-[oklch(0.10_0.02_250)] px-1 py-1 text-center font-heading text-xs text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
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
            Închide
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Academy-wide player search ───────────────────────────────────────────────

function AcademySearch({
  excludeIds,
  onAdd,
}: {
  excludeIds: Set<string>;
  onAdd: (p: AcademyPlayer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AcademyPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const mine = ++reqId.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/academy/players?q=${encodeURIComponent(term)}`,
          { headers: await authHeaders() }
        );
        if (mine !== reqId.current) return; // a newer keystroke won
        const j = (await r.json()) as { players?: AcademyPlayer[] };
        setResults(j.players ?? []);
      } catch {
        if (mine === reqId.current) setResults([]);
      } finally {
        if (mine === reqId.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const visible = results.filter((p) => !excludeIds.has(p.id));

  return (
    <div className="mt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-white/65 transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
        >
          <Search className="size-3" />
          Adaugă din academie
        </button>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[oklch(0.10_0.02_250)]/60 p-3">
          <div className="flex items-center gap-2">
            <Search className="size-3.5 text-white/40" />
            <input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Caută orice copil din academie după nume…"
              className="flex-1 bg-transparent font-body text-sm text-white placeholder:text-white/30 outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQ("");
                setResults([]);
              }}
              className="grid size-6 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Închide căutarea"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="mt-2 max-h-56 overflow-y-auto">
            {searching ? (
              <div className="grid place-items-center py-4">
                <Loader2 className="size-4 animate-spin text-brand-cyan" />
              </div>
            ) : visible.length === 0 ? (
              <p className="py-3 text-center font-body text-xs text-white/40">
                {q.trim() ? "Niciun jucător găsit." : "Scrie un nume pentru a căuta."}
              </p>
            ) : (
              <ul className="grid gap-1">
                {visible.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onAdd(p)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-brand-gold/40 hover:bg-brand-gold/[0.06]"
                    >
                      <span className="font-heading text-sm text-white">
                        {p.name}
                        {p.groupLabel && (
                          <span className="ml-1.5 font-body text-xs text-white/45">
                            {p.groupLabel}
                          </span>
                        )}
                      </span>
                      <Plus className="size-3.5 shrink-0 text-brand-gold" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
