/**
 * ProposedMatchesQueue — pending match proposals awaiting approval.
 *
 * Anyone (a parent, mainly) can propose a match; it lands as approval_status
 * 'proposed' and shows here for the people who can approve it:
 *   • trainer → pass their own trainer id → only their group's proposals
 *   • owner   → omit trainerId → every pending proposal
 *
 * Accept (accept_match) activates it + lets it be notified; Reject
 * (reject_match) hides it. Renders nothing when the queue is empty.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Clock, Check, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Proposed = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  opponent: string | null;
};

export default function ProposedMatchesQueue({
  trainerId,
  onChanged,
}: {
  trainerId?: string;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<Proposed[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from("schedule_events")
      .select("id, title, starts_at, location, opponent")
      .eq("kind", "match")
      .eq("approval_status", "proposed")
      .order("starts_at", { ascending: true });
    if (trainerId) q = q.eq("trainer_id", trainerId);
    const { data } = await q;
    setRows((data ?? []) as Proposed[]);
    setLoading(false);
  }, [trainerId]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, rpc: "accept_match" | "reject_match") => {
    setBusyId(id);
    const { error } = await supabase.rpc(rpc, { p_event: id });
    setBusyId(null);
    if (error) {
      toast.error("Acțiunea a eșuat", { description: error.message });
      return;
    }
    toast.success(rpc === "accept_match" ? "Meci aprobat" : "Meci respins");
    setRows((prev) => prev.filter((r) => r.id !== id));
    onChanged?.();
  };

  if (loading || rows.length === 0) return null;

  return (
    <div className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.05] p-5">
      <h2 className="flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.2em] text-amber-200/90">
        <Clock className="size-4" />
        Meciuri propuse — în așteptare
        <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-amber-200">
          {rows.length}
        </span>
      </h2>

      <div className="mt-4 grid gap-2.5">
        {rows.map((r) => (
          <article
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/60 p-4"
          >
            <div className="min-w-0">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.04em] text-white">
                {r.title}
                {r.opponent && (
                  <span className="ml-1.5 font-body text-xs normal-case text-brand-cyan/80">
                    vs {r.opponent}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 font-body text-xs text-white/50">
                {new Date(r.starts_at).toLocaleString("ro-RO", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Bucharest",
                })}
                {r.location && (
                  <>
                    {" · "}
                    <MapPin className="inline size-3 -translate-y-px" /> {r.location}
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => decide(r.id, "accept_match")}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan px-3 py-1.5 font-heading text-[10px] font-semibold uppercase tracking-[0.14em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-50"
              >
                {busyId === r.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Check className="size-3" />
                )}
                Aprobă
              </button>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => decide(r.id, "reject_match")}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/30 bg-rose-300/[0.06] px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-rose-200/90 transition-colors hover:bg-rose-300/10 disabled:opacity-50"
              >
                <X className="size-3" />
                Respinge
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
