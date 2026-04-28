/**
 * Antrenor → Atribuiri tab.
 * Shows pending children whose birth year falls inside the trainer's
 * assigned group ranges. Trainer can accept or reject each child.
 */
import { useEffect, useState } from "react";
import { Loader2, UserCheck, UserX, UsersRound, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";

type PendingChild = {
  id: string;
  full_name: string;
  dob: string;
  parent: { full_name: string; phone: string | null } | null;
};

export default function AtribuiriTab({ trainerId }: { trainerId: string }) {
  const [pending, setPending] = useState<PendingChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPending = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("children")
      .select("id, full_name, dob, parent:profiles!children_parent_id_fkey(full_name, phone)")
      .is("trainer_id", null)
      .eq("assignment_status", "pending")
      .eq("status", "active")
      .order("dob", { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      setPending((data ?? []) as unknown as PendingChild[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleAccept = async (childId: string) => {
    setActionId(childId);
    setError(null);
    const { error: err } = await supabase
      .from("children")
      .update({ trainer_id: trainerId, assignment_status: "accepted" })
      .eq("id", childId);
    setActionId(null);
    if (err) setError(err.message);
    else loadPending();
  };

  const handleReject = async (childId: string) => {
    setActionId(childId);
    setError(null);
    const { error: err } = await supabase
      .from("children")
      .update({ assignment_status: "rejected" })
      .eq("id", childId);
    setActionId(null);
    if (err) setError(err.message);
    else loadPending();
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
            const birthYear = new Date(c.dob).getFullYear();
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
                    {busy ? <Loader2 className="size-3 animate-spin" /> : <UserX className="size-3" />}
                    Respinge
                  </button>
                  <button
                    onClick={() => handleAccept(c.id)}
                    disabled={busy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-cyan px-3 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[oklch(0.08_0.02_250)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="size-3 animate-spin" /> : <UserCheck className="size-3" />}
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
