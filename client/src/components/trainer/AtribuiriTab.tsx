/**
 * Antrenor → Atribuiri tab — "Cereri de înscriere".
 *
 * Shows pending children that either (a) picked THIS trainer at signup, or
 * (b) have no trainer yet but whose birth year falls inside one of the
 * trainer's group ranges. The trainer can Accept (→ assigns trainer + the
 * matching group and applies the academy fee, via the enroll_accept RPC) or
 * Reject.
 */
import { useEffect, useState } from "react";
import { Loader2, UserCheck, UserX, UsersRound, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { birthYearFromDob } from "@shared/date";

type PendingChild = {
  id: string;
  full_name: string;
  dob: string;
  trainer_id: string | null;
  parent: { full_name: string; phone: string | null } | null;
};

type GroupRange = { id: string; birth_year_min: number; birth_year_max: number };

export default function AtribuiriTab({ trainerId }: { trainerId: string }) {
  const [pending, setPending] = useState<PendingChild[]>([]);
  const [ranges, setRanges] = useState<GroupRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPending = async () => {
    setLoading(true);
    setError(null);

    // 1) Trainer's groups (id + year range) — used to match unassigned kids
    //    and to pick the right group when accepting.
    const { data: groups, error: groupsErr } = await supabase
      .from("groups")
      .select("id, birth_year_min, birth_year_max")
      .eq("trainer_id", trainerId)
      .eq("active", true);

    if (groupsErr) {
      setError(groupsErr.message);
      setLoading(false);
      return;
    }

    const r = (groups ?? []) as GroupRange[];
    setRanges(r);

    // 2) Pending children: assigned to me OR not yet assigned to anyone.
    const { data, error: err } = await supabase
      .from("children")
      .select(
        "id, full_name, dob, trainer_id, parent:profiles!children_parent_id_fkey(full_name, phone)"
      )
      .eq("assignment_status", "pending")
      .eq("status", "active")
      .or(`trainer_id.eq.${trainerId},trainer_id.is.null`)
      .order("dob", { ascending: true });

    if (err) {
      setError(err.message);
      setPending([]);
    } else {
      const all = (data ?? []) as unknown as PendingChild[];
      const inRange = (year: number) =>
        r.some((g) => year >= g.birth_year_min && year <= g.birth_year_max);
      // Keep: kids who chose me, or unassigned kids in my year range.
      setPending(
        all.filter((c) => {
          if (c.trainer_id === trainerId) return true;
          if (c.trainer_id == null)
            return inRange(birthYearFromDob(c.dob));
          return false;
        })
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  const handleAccept = async (child: PendingChild) => {
    setActionId(child.id);
    setError(null);
    try {
      const year = birthYearFromDob(child.dob);
      const group = ranges.find(
        (g) => year >= g.birth_year_min && year <= g.birth_year_max
      );
      const { error: err } = await supabase.rpc("enroll_accept", {
        p_child: child.id,
        p_group: group?.id ?? null,
        p_trainer: trainerId,
      });
      if (err) setError(err.message);
      else loadPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la acceptare");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (childId: string) => {
    setActionId(childId);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("enroll_reject", {
        p_child: childId,
      });
      if (err) setError(err.message);
      else loadPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la respingere");
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Loader2 className="size-5 animate-spin text-brand-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-[0.02em] text-white">
          <UsersRound className="size-5 text-brand-cyan" />
          Cereri de înscriere
        </h2>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-heading text-[11px] uppercase tracking-[0.14em] text-white/60">
          {pending.length} {pending.length === 1 ? "copil" : "copii"}
        </span>
      </div>

      <p className="font-body text-xs text-white/45">
        Dacă accepți, copilul intră în grupa ta și se aplică taxa lunară a
        academiei.
      </p>

      {error && (
        <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
          {error}
        </p>
      )}

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
          <UsersRound className="mx-auto size-8 text-white/20" />
          <p className="mt-3 font-body text-sm text-white/50">
            Nu există cereri noi în intervalul tău de ani.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((c) => {
            const birthYear = birthYearFromDob(c.dob);
            const busy = actionId === c.id;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold text-white">
                    {c.full_name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 font-body text-xs text-white/50">
                    <span>Născut: {birthYear}</span>
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" />
                      {c.parent?.full_name ?? "—"}
                      {c.parent?.phone ? ` · ${c.parent.phone}` : ""}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReject(c.id)}
                    disabled={busy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-200 transition-colors hover:bg-rose-300/20 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <UserX className="size-3" />
                    )}
                    Respinge
                  </button>
                  <button
                    onClick={() => handleAccept(c)}
                    disabled={busy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-cyan px-3 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[oklch(0.08_0.02_250)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <UserCheck className="size-3" />
                    )}
                    Acceptă
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
