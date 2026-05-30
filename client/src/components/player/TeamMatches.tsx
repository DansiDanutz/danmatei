/**
 * TeamMatches — the parent's match surface on /copil/:childId.
 *
 *  • Lists the team's matches (the child's group): active/finished matches plus
 *    the parent's own still-pending proposals ("în așteptare").
 *  • "Propune un meci" → propose_match RPC (lands as 'proposed', awaiting the
 *    trainer/owner's approval; the child is auto-added to the squad).
 *  • On an ACTIVE match where the child is in the squad, the parent can edit the
 *    score and attribute goals to squad players → set_match_score RPC.
 *
 * All writes go through SECURITY DEFINER RPCs that enforce authorization; the
 * squad (for the scorer picker) is read via /api/match/squad.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Swords,
  Plus,
  X,
  Trophy,
  Clock,
  MapPin,
  Pencil,
  Save,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { TRAINING_BASES, OTHER_LOCATION } from "@/lib/locations";
import MatchPhotos from "@/components/trainer/MatchPhotos";

type Scorer = { child_id: string; name: string; goals: number };
type MatchResult = {
  our_score: number;
  opponent_score: number;
  scorers: Scorer[] | null;
};
type TeamMatch = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  opponent: string | null;
  approval_status: "proposed" | "approved" | "rejected";
  finalized_at: string | null;
  created_by: string | null;
  result: MatchResult | null;
};
type SquadMember = { childId: string; name: string };

const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 outline-none focus:border-brand-cyan/60";

function dtRO(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function normalizeResult(raw: unknown): MatchResult | null {
  const r = Array.isArray(raw) ? raw[0] : raw;
  if (!r) return null;
  const rr = r as MatchResult;
  return {
    our_score: rr.our_score ?? 0,
    opponent_score: rr.opponent_score ?? 0,
    scorers: Array.isArray(rr.scorers) ? rr.scorers : [],
  };
}

export default function TeamMatches({
  childId,
  trainerId,
  parentId,
}: {
  childId: string;
  trainerId: string | null;
  parentId: string;
}) {
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!trainerId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("schedule_events")
      .select(
        "id, title, starts_at, location, opponent, approval_status, finalized_at, created_by, result:match_results(our_score, opponent_score, scorers)"
      )
      .eq("trainer_id", trainerId)
      .eq("kind", "match")
      .order("starts_at", { ascending: false });

    const rows = ((data ?? []) as unknown as TeamMatch[])
      .map((m) => ({ ...m, result: normalizeResult(m.result) }))
      // approved (active/finished) for everyone; a parent also sees their own
      // proposals still awaiting approval. Rejected stays hidden.
      .filter(
        (m) =>
          m.approval_status === "approved" ||
          (m.approval_status === "proposed" && m.created_by === parentId)
      );
    setMatches(rows);
    setLoading(false);
  }, [trainerId, parentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
          <Swords className="size-4 text-brand-gold" />
          Meciurile echipei
        </h2>
        <button
          type="button"
          onClick={() => setProposing((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-brand-cyan transition-colors hover:bg-brand-cyan/20"
        >
          {proposing ? <X className="size-3" /> : <Plus className="size-3" />}
          {proposing ? "Anulează" : "Propune un meci"}
        </button>
      </div>

      {!trainerId && (
        <p className="mt-3 font-body text-sm text-white/45">
          Copilul nu este încă într-o grupă, așa că nu există meciuri de echipă.
        </p>
      )}

      {proposing && trainerId && (
        <ProposeForm
          childId={childId}
          onDone={() => {
            setProposing(false);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="mt-4 grid place-items-center py-6">
          <Loader2 className="size-5 animate-spin text-brand-cyan" />
        </div>
      ) : trainerId && matches.length === 0 ? (
        <p className="mt-4 font-body text-sm text-white/45">
          Niciun meci încă. Propune unul — antrenorul îl va aproba.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              editing={editingId === m.id}
              onToggleEdit={() =>
                setEditingId((id) => (id === m.id ? null : m.id))
              }
              onSaved={() => {
                setEditingId(null);
                load();
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Match card (display + parent score editor) ───────────────────────────────

function MatchCard({
  match,
  editing,
  onToggleEdit,
  onSaved,
}: {
  match: TeamMatch;
  editing: boolean;
  onToggleEdit: () => void;
  onSaved: () => void;
}) {
  const isProposed = match.approval_status === "proposed";
  const result = match.result;
  const scorers = (result?.scorers ?? []).filter((s) => s.goals > 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.04em] text-white">
              {match.title}
            </h3>
            {isProposed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.14em] text-amber-200">
                <Clock className="size-2.5" />
                În așteptare
              </span>
            )}
          </div>
          <p className="mt-1 font-body text-xs text-white/50">
            {dtRO(match.starts_at)}
            {match.location && (
              <>
                {" · "}
                <MapPin className="inline size-3 -translate-y-px" />{" "}
                {match.location}
              </>
            )}
          </p>
          {match.opponent && (
            <p className="mt-0.5 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan/80">
              vs {match.opponent}
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
            !isProposed && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-heading text-[10px] uppercase tracking-[0.16em] text-white/45">
                Fără scor
              </span>
            )
          )}
          {!isProposed && (
            <button
              type="button"
              onClick={onToggleEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              <Pencil className="size-3" />
              {result ? "Editează scorul" : "Adaugă scorul"}
            </button>
          )}
        </div>
      </div>

      {scorers.length > 0 && !editing && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/5 px-4 py-2.5">
          {scorers.map((s) => (
            <span
              key={s.child_id}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 font-body text-xs text-white/70"
            >
              ⚽ {s.name}
              {s.goals > 1 && (
                <span className="font-heading text-[10px] text-brand-gold">
                  ×{s.goals}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {editing && <ScoreEditor match={match} onSaved={onSaved} onCancel={onToggleEdit} />}
      {result && !editing && <MatchPhotos eventId={match.id} />}
    </article>
  );
}

// ── Parent score editor ──────────────────────────────────────────────────────

function ScoreEditor({
  match,
  onSaved,
  onCancel,
}: {
  match: TeamMatch;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [squad, setSquad] = useState<SquadMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [our, setOur] = useState(match.result?.our_score ?? 0);
  const [opp, setOpp] = useState(match.result?.opponent_score ?? 0);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/match/squad?eventId=${match.id}`, {
        headers: { authorization: `Bearer ${await bearer()}` },
      });
      if (cancelled) return;
      const j = r.ok
        ? ((await r.json()) as { squad: { childId: string; name: string }[] })
        : { squad: [] };
      setSquad(j.squad.map((s) => ({ childId: s.childId, name: s.name })));
      // prefill goals from existing scorers
      const init: Record<string, number> = {};
      (match.result?.scorers ?? []).forEach((s) => {
        init[s.child_id] = s.goals;
      });
      setGoals(init);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [match.id, match.result]);

  const save = async () => {
    setSaving(true);
    const scorers = Object.entries(goals)
      .filter(([, g]) => g > 0)
      .map(([child_id, g]) => ({ child_id, goals: g }));
    const { error } = await supabase.rpc("set_match_score", {
      p_event: match.id,
      p_our: our,
      p_opp: opp,
      p_scorers: scorers,
    });
    setSaving(false);
    if (error) {
      toast.error("Nu am putut salva scorul", { description: error.message });
      return;
    }
    toast.success("Scor salvat");
    onSaved();
  };

  return (
    <div className="border-t border-white/8 bg-[oklch(0.10_0.02_250)]/40 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            Noi
          </label>
          <input
            type="number"
            min={0}
            value={our}
            onChange={(e) => setOur(parseInt(e.target.value) || 0)}
            className="w-16 rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 text-center font-heading text-lg font-bold text-brand-cyan focus:border-brand-cyan/60"
          />
        </div>
        <span className="pb-2 font-heading text-xl text-white/30">·</span>
        <div>
          <label className="mb-1 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            Adversar
          </label>
          <input
            type="number"
            min={0}
            value={opp}
            onChange={(e) => setOpp(parseInt(e.target.value) || 0)}
            className="w-16 rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 text-center font-heading text-lg font-bold text-white/70 focus:border-brand-cyan/60"
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/50">
          Cine a marcat?
        </p>
        {!loaded ? (
          <Loader2 className="mt-2 size-4 animate-spin text-brand-cyan" />
        ) : squad.length === 0 ? (
          <p className="mt-1 font-body text-xs text-white/40">
            Echipa nu are încă jucători adăugați de antrenor.
          </p>
        ) : (
          <div className="mt-2 grid gap-1.5">
            {squad.map((s) => (
              <div
                key={s.childId}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5"
              >
                <span className="font-body text-sm text-white">{s.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-body text-[10px] text-white/40">goluri</span>
                  <input
                    type="number"
                    min={0}
                    value={goals[s.childId] ?? 0}
                    onChange={(e) =>
                      setGoals((g) => ({
                        ...g,
                        [s.childId]: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-12 rounded-lg border border-white/10 bg-[oklch(0.10_0.02_250)] px-1 py-1 text-center font-heading text-xs text-white"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvează scorul
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-heading text-[11px] uppercase tracking-[0.14em] text-white/70 hover:text-white"
        >
          Închide
        </button>
      </div>
    </div>
  );
}

// ── Propose form ─────────────────────────────────────────────────────────────

function ProposeForm({
  childId,
  onDone,
}: {
  childId: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [locChoice, setLocChoice] = useState<string>(TRAINING_BASES[0]);
  const [customLoc, setCustomLoc] = useState("");
  const [opponent, setOpponent] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Adaugă un titlu pentru meci.");
      return;
    }
    if (!startsAt) {
      toast.error("Alege data și ora.");
      return;
    }
    const location =
      locChoice === OTHER_LOCATION ? customLoc.trim() || null : locChoice;
    setSaving(true);
    const { error } = await supabase.rpc("propose_match", {
      p_child: childId,
      p_title: title.trim(),
      p_starts_at: new Date(startsAt).toISOString(),
      p_location: location,
      p_opponent: opponent.trim() || null,
      p_notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Propunerea a eșuat", { description: error.message });
      return;
    }
    toast.success("Propunere trimisă — așteaptă aprobarea antrenorului.");
    onDone();
  };

  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.04] p-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titlu (ex: Amical cu FC Vecinii)"
        className={INPUT_CLS}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className={INPUT_CLS}
          aria-label="Data și ora"
        />
        <input
          type="text"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          placeholder="Adversar (opțional)"
          className={INPUT_CLS}
        />
      </div>
      <select
        value={locChoice}
        onChange={(e) => setLocChoice(e.target.value)}
        className={INPUT_CLS}
      >
        {TRAINING_BASES.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
        <option value={OTHER_LOCATION}>{OTHER_LOCATION}</option>
      </select>
      {locChoice === OTHER_LOCATION && (
        <input
          type="text"
          value={customLoc}
          onChange={(e) => setCustomLoc(e.target.value)}
          placeholder="Scrie locația…"
          className={INPUT_CLS}
        />
      )}
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Detalii (opțional)"
        className={INPUT_CLS}
      />
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        Trimite propunerea
      </button>
    </div>
  );
}
