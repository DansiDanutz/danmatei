/**
 * SetTeamModal — "Setează echipa" popup for a generated match.
 *
 * Opened from a match card in ScheduleOversight. It lets an owner build the
 * MATCH SQUAD (fotbal.match_participations) for the match's group:
 *   1. Pick players from the match group's roster — select all or only some.
 *   2. Add guest players from any other group by searching the academy by name
 *      (/api/academy/players).
 *   3. "Finalizează echipa" → persists the squad (diffs against what's saved,
 *      inserting/removing rows) and then notifies every selected player's
 *      parent via /api/schedule/notify.
 *
 * Owners can read every child and write match_participations under RLS
 * (fotbal.is_owner()), so the roster + squad writes run on the browser client;
 * the current squad is read from /api/match/squad because that endpoint returns
 * guest call-ups from other groups that RLS would otherwise hide.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Megaphone,
  Plus,
  Search,
  Swords,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type TeamEvent = {
  id: string;
  title: string;
  opponent: string | null;
  starts_at: string;
  trainer_id: string;
};

type RosterChild = { id: string; full_name: string };

type SquadMember = {
  childId: string;
  name: string;
  groupLabel: string | null;
};

type AcademyPlayer = {
  id: string;
  name: string;
  yearOfBirth: number | null;
  groupLabel: string | null;
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    "content-type": "application/json",
    authorization: `Bearer ${data.session?.access_token ?? ""}`,
  };
}

export default function SetTeamModal({
  event,
  onClose,
  onDone,
}: {
  event: TeamEvent;
  onClose: () => void;
  onDone: () => void;
}) {
  const [roster, setRoster] = useState<RosterChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // childIds currently chosen (own group + guests)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // chosen players not in the group roster, kept so we can render their names
  const [guests, setGuests] = useState<Map<string, SquadMember>>(new Map());
  // the squad as saved on the server when the modal opened, for diffing
  const [savedSquad, setSavedSquad] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [rosterRes, squadRes] = await Promise.all([
      supabase
        .from("children")
        .select("id, full_name")
        .eq("trainer_id", event.trainer_id)
        .eq("status", "active")
        .order("full_name", { ascending: true }),
      fetch(`/api/match/squad?eventId=${event.id}`, {
        headers: await authHeaders(),
      }),
    ]);

    if (rosterRes.error) {
      setError(rosterRes.error.message);
      setLoading(false);
      return;
    }

    const rosterChildren = (rosterRes.data ?? []) as RosterChild[];
    setRoster(rosterChildren);
    const rosterIdSet = new Set(rosterChildren.map(c => c.id));

    let squad: {
      childId: string;
      name: string;
      groupLabel: string | null;
    }[] = [];
    if (squadRes.ok) {
      const j = (await squadRes.json()) as { squad?: typeof squad };
      squad = j.squad ?? [];
    }

    const chosen = new Set(squad.map(s => s.childId));
    const guestMap = new Map<string, SquadMember>();
    squad
      .filter(s => !rosterIdSet.has(s.childId))
      .forEach(s =>
        guestMap.set(s.childId, {
          childId: s.childId,
          name: s.name,
          groupLabel: s.groupLabel ?? null,
        })
      );

    setSelected(chosen);
    setGuests(guestMap);
    setSavedSquad(new Set(chosen));
    setLoading(false);
  }, [event.id, event.trainer_id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (childId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(childId)) next.delete(childId);
      else next.add(childId);
      return next;
    });
  };

  const selectAllGroup = () => {
    setSelected(prev => {
      const next = new Set(prev);
      roster.forEach(c => next.add(c.id));
      return next;
    });
  };

  const clearGroup = () => {
    setSelected(prev => {
      const next = new Set(prev);
      roster.forEach(c => next.delete(c.id));
      return next;
    });
  };

  const addGuest = (p: AcademyPlayer) => {
    setGuests(prev => {
      const next = new Map(prev);
      next.set(p.id, {
        childId: p.id,
        name: p.name,
        groupLabel: p.groupLabel,
      });
      return next;
    });
    setSelected(prev => new Set(prev).add(p.id));
  };

  const removeGuest = (childId: string) => {
    setGuests(prev => {
      const next = new Map(prev);
      next.delete(childId);
      return next;
    });
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(childId);
      return next;
    });
  };

  const groupSelectedCount = useMemo(
    () => roster.filter(c => selected.has(c.id)).length,
    [roster, selected]
  );
  const guestList = useMemo(
    () => Array.from(guests.values()).filter(g => selected.has(g.childId)),
    [guests, selected]
  );

  const finalize = async () => {
    if (selected.size === 0) {
      toast.error("Selectează cel puțin un jucător înainte de a finaliza.");
      return;
    }
    setFinalizing(true);
    setError(null);
    try {
      const toAdd = Array.from(selected).filter(id => !savedSquad.has(id));
      const toRemove = Array.from(savedSquad).filter(id => !selected.has(id));

      if (toAdd.length > 0) {
        const { error: insErr } = await supabase
          .from("match_participations")
          .upsert(
            toAdd.map(childId => ({
              event_id: event.id,
              child_id: childId,
              role: "starter",
              goals: 0,
              assists: 0,
            })),
            { onConflict: "event_id, child_id" }
          );
        if (insErr) throw insErr;
      }

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from("match_participations")
          .delete()
          .eq("event_id", event.id)
          .in("child_id", toRemove);
        if (delErr) throw delErr;
      }

      const r = await fetch("/api/schedule/notify", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ eventId: event.id }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        notified?: number;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? `API ${r.status}`);

      const n = j.notified ?? 0;
      toast.success(
        `Echipă finalizată — ${selected.size} ${
          selected.size === 1 ? "jucător" : "jucători"
        }, ${n} ${n === 1 ? "părinte notificat" : "părinți notificați"}.`
      );
      onDone();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare la finalizare.";
      setError(msg);
      toast.error("Finalizarea a eșuat", { description: msg });
    } finally {
      setFinalizing(false);
    }
  };

  const matchTime = new Date(event.starts_at).toLocaleString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });

  return (
    <Dialog
      open
      onOpenChange={o => {
        if (!o && !finalizing) onClose();
      }}
    >
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden border-white/10 bg-[oklch(0.13_0.03_250)] p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-white/8 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 font-heading text-base font-semibold text-white">
            <Swords className="size-4 text-brand-gold" />
            Setează echipa
          </DialogTitle>
          <DialogDescription className="font-body text-xs text-white/55">
            {event.title}
            {event.opponent && ` · vs ${event.opponent}`} · {matchTime}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid min-h-[30vh] place-items-center">
            <Loader2 className="size-5 animate-spin text-brand-cyan" />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            {/* Group roster */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.18em] text-white/55">
                <Users className="size-3.5 text-brand-cyan" />
                Grupa ({groupSelectedCount}/{roster.length})
              </h4>
              {roster.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllGroup}
                    disabled={groupSelectedCount === roster.length}
                    className="rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1 font-heading text-[10px] uppercase tracking-[0.14em] text-brand-cyan transition-colors hover:bg-brand-cyan/20 disabled:opacity-40"
                  >
                    Selectează tot
                  </button>
                  <button
                    type="button"
                    onClick={clearGroup}
                    disabled={groupSelectedCount === 0}
                    className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 font-heading text-[10px] uppercase tracking-[0.14em] text-white/60 transition-colors hover:text-white disabled:opacity-40"
                  >
                    Deselectează
                  </button>
                </div>
              )}
            </div>

            {roster.length === 0 ? (
              <p className="mt-2 font-body text-xs text-white/40">
                Niciun copil activ în grupă. Poți adăuga jucători din academie
                mai jos.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {roster.map(c => {
                  const inSquad = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-[11px] tracking-[0.02em] transition-colors ${
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
            {guestList.length > 0 && (
              <>
                <h4 className="mt-5 font-heading text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Invitați din academie ({guestList.length})
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {guestList.map(g => (
                    <span
                      key={g.childId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1.5 font-heading text-[11px] text-brand-gold"
                    >
                      {g.name}
                      {g.groupLabel && (
                        <span className="text-brand-gold/60">
                          · {g.groupLabel}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeGuest(g.childId)}
                        className="ml-0.5 grid size-4 place-items-center rounded-full hover:bg-brand-gold/20"
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
            <AcademySearch excludeIds={selected} onAdd={addGuest} />

            {error && (
              <p className="mt-4 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-4">
          <span className="font-heading text-[11px] uppercase tracking-[0.14em] text-white/50">
            {selected.size} selectați
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={finalizing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-heading text-[11px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:text-white disabled:opacity-50"
            >
              Renunță
            </button>
            <button
              type="button"
              onClick={finalize}
              disabled={finalizing || loading || selected.size === 0}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.16em] text-[oklch(0.11_0.03_250)] transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {finalizing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Megaphone className="size-3.5" />
              )}
              Finalizează echipa
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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

  const visible = results.filter(p => !excludeIds.has(p.id));

  return (
    <div className="mt-5">
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
              onChange={e => setQ(e.target.value)}
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
                {q.trim()
                  ? "Niciun jucător găsit."
                  : "Scrie un nume pentru a căuta."}
              </p>
            ) : (
              <ul className="grid gap-1">
                {visible.map(p => (
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
