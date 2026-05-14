/**
 * AttendanceTab — fast attendance entry for trainers in the field.
 *
 * Field reality: trainer is on the pitch with a phone, has 20 kids to mark
 * in <30 seconds before the session starts. Two design choices:
 *
 *   1. "Toți prezenți" bulk button. Most sessions, everyone shows up — tap
 *      once and only edit the 1-2 absentees.
 *   2. Per-kid single tap cycles unset → present → absent → unset. The
 *      common case (present) is one tap; absent is two; clearing is three.
 *      Each tap saves immediately (optimistic).
 *
 * Late and excused are rare statuses — they live as small chips inside an
 * expandable "..." menu so they don't crowd the main tap target.
 *
 * Shows training events from the past 7 days.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Dumbbell,
  Loader2,
  MoreHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Child = { id: string; full_name: string };

type TrainingEvent = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
};

type AttendanceStatus = "present" | "absent" | "late" | "excused";

type AttendanceRow = {
  id: string;
  event_id: string;
  child_id: string;
  status: AttendanceStatus;
  notes: string | null;
};

const SECONDARY_STATUSES: AttendanceStatus[] = ["late", "excused"];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Prezent",
  absent: "Absent",
  late: "Întârziat",
  excused: "Motivat",
};

const SECONDARY_META: Record<
  "late" | "excused",
  { label: string; icon: typeof Clock; chipClass: string; activeClass: string }
> = {
  late: {
    label: "Întârziat",
    icon: Clock,
    chipClass:
      "border-white/12 bg-white/[0.04] text-white/55 hover:text-amber-300",
    activeClass: "border-amber-300/45 bg-amber-300/15 text-amber-300",
  },
  excused: {
    label: "Motivat",
    icon: AlertCircle,
    chipClass:
      "border-white/12 bg-white/[0.04] text-white/55 hover:text-brand-cyan",
    activeClass: "border-brand-cyan/45 bg-brand-cyan/15 text-brand-cyan",
  },
};

export default function AttendanceTab({
  trainerId,
  children,
}: {
  trainerId: string;
  children: Child[];
}) {
  const [events, setEvents] = useState<TrainingEvent[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRow>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const horizon = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: evData, error: evErr } = await supabase
      .from("schedule_events")
      .select("id, title, starts_at, location")
      .eq("trainer_id", trainerId)
      .eq("kind", "training")
      .gte("starts_at", horizon)
      .order("starts_at", { ascending: false });

    if (evErr) {
      setError(evErr.message);
      setLoading(false);
      return;
    }

    const evs = (evData ?? []) as TrainingEvent[];
    setEvents(evs);

    if (evs.length > 0) {
      const eventIds = evs.map(e => e.id);
      const { data: attData } = await supabase
        .from("attendance")
        .select("id, event_id, child_id, status, notes")
        .in("event_id", eventIds);

      const map = new Map<string, AttendanceRow>();
      (attData ?? []).forEach((a: AttendanceRow) => {
        map.set(`${a.event_id}-${a.child_id}`, a);
      });
      setAttendance(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  const persist = async (
    eventId: string,
    childId: string,
    status: AttendanceStatus | null
  ): Promise<boolean> => {
    const key = `${eventId}-${childId}`;
    const existing = attendance.get(key);

    // status === null means "delete the row" (cycle back to unset).
    if (status === null) {
      if (!existing?.id) return true;
      const { error: delErr } = await supabase
        .from("attendance")
        .delete()
        .eq("id", existing.id);
      if (delErr) {
        toast.error("Nu am putut șterge", {
          description: delErr.message,
        });
        return false;
      }
      setAttendance(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      return true;
    }

    const { data: upserted, error: upErr } = await supabase
      .from("attendance")
      .upsert(
        existing?.id
          ? { id: existing.id, event_id: eventId, child_id: childId, status }
          : { event_id: eventId, child_id: childId, status },
        { onConflict: "event_id, child_id" }
      )
      .select("id")
      .single();
    if (upErr) {
      toast.error("Nu am putut salva", { description: upErr.message });
      return false;
    }
    setAttendance(prev => {
      const next = new Map(prev);
      next.set(key, {
        id: (upserted?.id as string) ?? existing?.id ?? "",
        event_id: eventId,
        child_id: childId,
        status,
        notes: existing?.notes ?? null,
      });
      return next;
    });
    return true;
  };

  // Single-tap cycle: unset → present → absent → unset.
  const cycle = async (eventId: string, childId: string) => {
    const key = `${eventId}-${childId}`;
    setSavingKey(key);
    const cur = attendance.get(key)?.status ?? null;
    const next: AttendanceStatus | null =
      cur === null ? "present" : cur === "present" ? "absent" : null;
    await persist(eventId, childId, next);
    setSavingKey(null);
  };

  const setSecondary = async (
    eventId: string,
    childId: string,
    status: AttendanceStatus
  ) => {
    const key = `${eventId}-${childId}`;
    setSavingKey(key);
    const cur = attendance.get(key)?.status ?? null;
    // Tap the chip again to cycle back to unset.
    const next = cur === status ? null : status;
    await persist(eventId, childId, next);
    setSavingKey(null);
    setOpenMenu(null);
  };

  // Bulk operation — one round-trip upsert for the whole group.
  const bulkSet = async (
    eventId: string,
    status: AttendanceStatus | null
  ): Promise<void> => {
    setBulkBusy(eventId);
    if (status === null) {
      // Reset = delete every row for this event for the trainer's kids.
      const { error: delErr } = await supabase
        .from("attendance")
        .delete()
        .eq("event_id", eventId)
        .in(
          "child_id",
          children.map(c => c.id)
        );
      if (delErr) {
        toast.error("Nu am putut reseta", { description: delErr.message });
        setBulkBusy(null);
        return;
      }
      setAttendance(prev => {
        const next = new Map(prev);
        for (const c of children) next.delete(`${eventId}-${c.id}`);
        return next;
      });
      toast.success(`Resetat — ${children.length} jucători`);
    } else {
      const rows = children.map(c => ({
        event_id: eventId,
        child_id: c.id,
        status,
      }));
      const { data: upserted, error: upErr } = await supabase
        .from("attendance")
        .upsert(rows, { onConflict: "event_id, child_id" })
        .select("id, event_id, child_id, status");
      if (upErr) {
        toast.error("Nu am putut salva în bloc", {
          description: upErr.message,
        });
        setBulkBusy(null);
        return;
      }
      setAttendance(prev => {
        const next = new Map(prev);
        ((upserted ?? []) as AttendanceRow[]).forEach(r => {
          next.set(`${r.event_id}-${r.child_id}`, {
            id: r.id,
            event_id: r.event_id,
            child_id: r.child_id,
            status: r.status,
            notes: null,
          });
        });
        return next;
      });
      toast.success(`Marcat ${STATUS_LABEL[status].toLowerCase()} pentru ${children.length} jucători`);
    }
    setBulkBusy(null);
  };

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("ro-RO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/Bucharest",
      }),
    []
  );

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("ro-RO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Bucharest",
      }),
    []
  );

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
        <Dumbbell className="mx-auto size-8 text-white/20" />
        <p className="mt-3 font-body text-sm text-white/50">
          Nu există antrenamente în ultimele 7 zile.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {events.map(ev => {
        const counts = { present: 0, absent: 0, late: 0, excused: 0 };
        for (const c of children) {
          const s = attendance.get(`${ev.id}-${c.id}`)?.status;
          if (s) counts[s] += 1;
        }
        const totalMarked =
          counts.present + counts.absent + counts.late + counts.excused;

        return (
          <article
            key={ev.id}
            className="overflow-hidden rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-4">
              <div className="flex items-center gap-3">
                <Dumbbell className="size-4 text-brand-cyan" />
                <div>
                  <h3 className="font-heading text-sm font-semibold text-white">
                    {ev.title}
                  </h3>
                  <p className="font-body text-xs text-white/50">
                    {dateFmt.format(new Date(ev.starts_at))} ·{" "}
                    {timeFmt.format(new Date(ev.starts_at))}
                    {ev.location && ` · ${ev.location}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                  {totalMarked}/{children.length}
                </span>
                {counts.present > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/[0.08] px-2 py-0.5 font-heading text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                    <CheckCheck className="size-3" />
                    {counts.present}
                  </span>
                )}
                {counts.absent > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/30 bg-rose-300/[0.08] px-2 py-0.5 font-heading text-[10px] uppercase tracking-[0.14em] text-rose-300">
                    <X className="size-3" />
                    {counts.absent}
                  </span>
                )}
              </div>
            </div>

            {/* Bulk actions */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-2.5">
              <button
                type="button"
                onClick={() => void bulkSet(ev.id, "present")}
                disabled={bulkBusy === ev.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-300/[0.10] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-emerald-300 transition-colors hover:bg-emerald-300/20 disabled:opacity-60"
              >
                {bulkBusy === ev.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="size-3.5" />
                )}
                Toți prezenți
              </button>
              <button
                type="button"
                onClick={() => void bulkSet(ev.id, null)}
                disabled={bulkBusy === ev.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-white/65 transition-colors hover:text-white disabled:opacity-60"
              >
                Resetează
              </button>
              <span className="ml-auto font-heading text-[10px] uppercase tracking-[0.18em] text-white/35">
                Tap = Prezent · 2× tap = Absent · 3× tap = Resetat
              </span>
            </div>

            {/* Per-kid grid */}
            <ul className="grid gap-1 p-3">
              {children.map(c => {
                const key = `${ev.id}-${c.id}`;
                const att = attendance.get(key);
                const status = att?.status ?? null;
                const busy = savingKey === key;
                const menuOpen = openMenu === key;

                const mainClass = (() => {
                  if (status === "present")
                    return "border-emerald-300/40 bg-emerald-300/[0.10] text-emerald-300";
                  if (status === "absent")
                    return "border-rose-300/40 bg-rose-300/[0.10] text-rose-300";
                  if (status === "late")
                    return "border-amber-300/40 bg-amber-300/[0.10] text-amber-300";
                  if (status === "excused")
                    return "border-brand-cyan/40 bg-brand-cyan/[0.10] text-brand-cyan";
                  return "border-white/12 bg-white/[0.03] text-white/55";
                })();

                const mainIcon = (() => {
                  if (status === "present") return <Check className="size-4" />;
                  if (status === "absent") return <X className="size-4" />;
                  if (status === "late") return <Clock className="size-4" />;
                  if (status === "excused")
                    return <AlertCircle className="size-4" />;
                  return null;
                })();

                const mainLabel = status ? STATUS_LABEL[status] : "Marchează";

                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate font-heading text-sm text-white">
                      {c.full_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => void cycle(ev.id, c.id)}
                      disabled={busy || bulkBusy === ev.id}
                      aria-label={`${c.full_name}: ${mainLabel}. Tap pentru a schimba.`}
                      className={`inline-flex min-w-[112px] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.14em] transition ${mainClass} disabled:opacity-50`}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        mainIcon
                      )}
                      {mainLabel}
                    </button>

                    {/* Secondary chips for late / excused — hidden behind a
                     *  three-dot menu to keep the main row clean. */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenu(menuOpen ? null : key)}
                        aria-label="Mai multe opțiuni"
                        className={`inline-flex size-8 items-center justify-center rounded-lg border transition-colors ${
                          status === "late" || status === "excused"
                            ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
                            : "border-white/10 bg-white/[0.02] text-white/45 hover:text-white/80"
                        }`}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </button>
                      {menuOpen && (
                        <div className="absolute right-0 top-full z-20 mt-1 flex flex-col gap-1 rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] p-1.5 shadow-xl">
                          {SECONDARY_STATUSES.map(s => {
                            const meta = SECONDARY_META[s as "late" | "excused"];
                            const SIcon = meta.icon;
                            const active = status === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => void setSecondary(ev.id, c.id, s)}
                                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-heading text-[10.5px] uppercase tracking-[0.14em] transition ${
                                  active ? meta.activeClass : meta.chipClass
                                }`}
                              >
                                <SIcon className="size-3.5" />
                                {meta.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
