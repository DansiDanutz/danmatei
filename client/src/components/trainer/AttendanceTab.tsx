/**
 * AttendanceTab — Trainer attendance tracking for training sessions.
 *
 * Shows schedule_events of kind='training' from the past 7 days.
 * For each event, trainer toggles attendance per child: present / absent / late / excused.
 */
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Dumbbell } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Child = { id: string; full_name: string };

type TrainingEvent = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
};

type AttendanceRow = {
  id: string;
  event_id: string;
  child_id: string;
  status: "present" | "absent" | "late" | "excused";
  notes: string | null;
};

const STATUS_META: Record<
    string,
{ label: string; icon: typeof CheckCircle2; active: string }
  > = {
    present: { label: "Prezent", icon: CheckCircle2, active: "border-emerald-300/30 bg-emerald-300/10 text-emerald-300" },
    absent: { label: "Absent", icon: XCircle, active: "border-rose-300/30 bg-rose-300/10 text-rose-300" },
    late: { label: "Întârziat", icon: Clock, active: "border-amber-300/30 bg-amber-300/10 text-amber-300" },
    excused: { label: "Motivat", icon: AlertCircle, active: "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan" },
};

export default function AttendanceTab({
  trainerId,
  children,
}: {
  trainerId: string;
  children: Child[];
}) {
  const [events, setEvents] = useState<TrainingEvent[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const horizon = new Date(Date.now() - 7 * 86400000).toISOString();
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
      const eventIds = evs.map((e) => e.id);
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

  const setStatus = async (
    eventId: string,
    childId: string,
    status: AttendanceRow["status"]
  ) => {
    const key = `${eventId}-${childId}`;
    setSaving(key);
    const existing = attendance.get(key);

    const { error: upErr } = await supabase.from("attendance").upsert(
      {
        id: existing?.id,
        event_id: eventId,
        child_id: childId,
        status,
      },
      { onConflict: "event_id, child_id" }
    );

    if (upErr) {
      setError(upErr.message);
    } else {
      setAttendance((prev) => {
        const next = new Map(prev);
        next.set(key, {
          id: existing?.id ?? "",
          event_id: eventId,
          child_id: childId,
          status,
          notes: null,
        });
        return next;
      });
    }
    setSaving(null);
  };

  const dateFmt = new Intl.DateTimeFormat("ro-RO", {
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
      {events.map((ev) => (
        <article
          key={ev.id}
          className="overflow-hidden rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70"
        >
          <div className="flex items-center gap-3 border-b border-white/5 p-4">
            <Dumbbell className="size-4 text-brand-cyan" />
            <div>
              <h3 className="font-heading text-sm font-semibold text-white">{ev.title}</h3>
              <p className="font-body text-xs text-white/50">
                {dateFmt.format(new Date(ev.starts_at))} · {timeFmt.format(new Date(ev.starts_at))}
                {ev.location && ` · ${ev.location}`}
              </p>
            </div>
          </div>

          <div className="grid gap-1 p-3">
            {children.map((c) => {
              const key = `${ev.id}-${c.id}`;
              const att = attendance.get(key);
              const currentStatus = att?.status ?? "present";
              const busy = saving === key;

              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <span className="font-heading text-sm text-white">{c.full_name}</span>
                  <div className="flex items-center gap-1">
                    {(["present", "absent", "late", "excused"] as const).map((s) => {
                      const meta = STATUS_META[s];
                      const Icon = meta.icon;
                      const active = currentStatus === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(ev.id, c.id, s)}
                          disabled={busy}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-heading text-[10px] uppercase tracking-[0.1em] transition-all ${
                            active
                                                ? meta.active
                              : "border-white/8 bg-transparent text-white/35 hover:text-white/60"
                          } disabled:opacity-50`}
                        >
                          <Icon className="size-3" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}
