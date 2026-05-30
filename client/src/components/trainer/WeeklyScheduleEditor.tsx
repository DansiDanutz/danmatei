/**
 * WeeklyScheduleEditor — the trainer's recurring weekly training pattern.
 * Each row (weekday + start/end time + location) is a template; saving any
 * change calls the regenerate_trainings RPC, which materialises real
 * schedule_events for the next 8 weeks (so each occurrence still supports
 * attendance / recap / cancel). Past + manual + cancelled events are kept.
 */
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, RefreshCw, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { TRAINING_BASES, OTHER_LOCATION } from "@/lib/locations";

type Template = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string | null;
  location: string | null;
  active: boolean;
};

const WEEKDAYS = [
  { v: 1, label: "Luni" },
  { v: 2, label: "Marți" },
  { v: 3, label: "Miercuri" },
  { v: 4, label: "Joi" },
  { v: 5, label: "Vineri" },
  { v: 6, label: "Sâmbătă" },
  { v: 7, label: "Duminică" },
];
const dayLabel = (v: number) => WEEKDAYS.find((d) => d.v === v)?.label ?? "—";
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

const SELECT_CLS =
  "h-10 rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 text-sm text-white outline-none focus:border-brand-cyan/60";

export default function WeeklyScheduleEditor({
  trainerId,
  onChanged,
}: {
  trainerId: string;
  onChanged: () => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:30");
  const [locChoice, setLocChoice] = useState<string>(TRAINING_BASES[0]);
  const [customLoc, setCustomLoc] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("training_templates")
      .select("id, weekday, start_time, end_time, location, active")
      .eq("trainer_id", trainerId)
      .order("weekday")
      .order("start_time");
    setTemplates((data ?? []) as Template[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  const regenerate = async (): Promise<boolean> => {
    const { error } = await supabase.rpc("regenerate_trainings", {
      p_trainer: trainerId,
      p_weeks: 8,
    });
    if (error) toast.error("Generare eșuată", { description: error.message });
    return !error;
  };

  const afterMutation = async (msg: string) => {
    await load();
    await regenerate();
    setBusy(false);
    toast.success(msg);
    onChanged();
  };

  const addTemplate = async () => {
    if (!startTime) {
      toast.error("Alege ora de început");
      return;
    }
    const location =
      locChoice === OTHER_LOCATION ? customLoc.trim() || null : locChoice;
    setBusy(true);
    const { error } = await supabase.from("training_templates").insert({
      trainer_id: trainerId,
      weekday,
      start_time: startTime,
      end_time: endTime || null,
      location,
      active: true,
    });
    if (error) {
      toast.error("Nu am putut adăuga", { description: error.message });
      setBusy(false);
      return;
    }
    setCustomLoc("");
    await afterMutation("Adăugat — antrenamentele au fost generate");
  };

  const removeTemplate = async (id: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("training_templates")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Eroare", { description: error.message });
      setBusy(false);
      return;
    }
    await afterMutation("Șters — calendar actualizat");
  };

  const toggleActive = async (t: Template) => {
    setBusy(true);
    const { error } = await supabase
      .from("training_templates")
      .update({ active: !t.active })
      .eq("id", t.id);
    if (error) {
      toast.error("Eroare", { description: error.message });
      setBusy(false);
      return;
    }
    await afterMutation(t.active ? "Dezactivat" : "Activat");
  };

  return (
    <div className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
          <CalendarRange className="size-4 text-brand-cyan" />
          Program săptămânal (se repetă)
        </h2>
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            const ok = await regenerate();
            setBusy(false);
            if (ok) {
              toast.success("Regenerat pe 8 săptămâni");
              onChanged();
            }
          }}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-white/70 hover:text-brand-cyan disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Regenerează
        </button>
      </div>
      <p className="mt-1 font-body text-xs text-white/45">
        Antrenamentele se completează automat în calendar pentru următoarele 8
        săptămâni.
      </p>

      {/* Add row */}
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_1.4fr_auto]">
        <select
          value={weekday}
          onChange={(e) => setWeekday(Number(e.target.value))}
          className={SELECT_CLS}
        >
          {WEEKDAYS.map((d) => (
            <option key={d.v} value={d.v}>
              {d.label}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className={`${SELECT_CLS} w-28`}
          aria-label="Ora început"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className={`${SELECT_CLS} w-28`}
          aria-label="Ora sfârșit"
        />
        <select
          value={locChoice}
          onChange={(e) => setLocChoice(e.target.value)}
          className={SELECT_CLS}
        >
          {TRAINING_BASES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
          <option value={OTHER_LOCATION}>{OTHER_LOCATION}</option>
        </select>
        <button
          type="button"
          onClick={addTemplate}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-cyan px-3 font-heading text-[10px] font-semibold uppercase tracking-[0.14em] text-[oklch(0.08_0.02_250)] disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Adaugă
        </button>
      </div>
      {locChoice === OTHER_LOCATION && (
        <input
          type="text"
          value={customLoc}
          onChange={(e) => setCustomLoc(e.target.value)}
          placeholder="Scrie locația…"
          className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-brand-cyan/60"
        />
      )}

      {/* List */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="grid place-items-center py-6">
            <Loader2 className="size-4 animate-spin text-brand-cyan" />
          </div>
        ) : templates.length === 0 ? (
          <p className="font-body text-xs text-white/45">
            Niciun antrenament recurent încă.
          </p>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                t.active
                  ? "border-white/10 bg-white/[0.03]"
                  : "border-white/5 bg-white/[0.01] opacity-50"
              }`}
            >
              <div className="min-w-0">
                <span className="font-heading text-[12px] font-semibold uppercase tracking-[0.04em] text-white">
                  {dayLabel(t.weekday)} · {hhmm(t.start_time)}
                  {t.end_time ? `–${hhmm(t.end_time)}` : ""}
                </span>
                {t.location && (
                  <span className="ml-2 font-body text-xs text-white/50">
                    {t.location}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleActive(t)}
                  disabled={busy}
                  className="rounded-lg border border-white/10 px-2 py-1 font-heading text-[9px] uppercase tracking-[0.12em] text-white/60 hover:text-brand-cyan disabled:opacity-50"
                >
                  {t.active ? "Pauză" : "Activează"}
                </button>
                <button
                  type="button"
                  onClick={() => removeTemplate(t.id)}
                  disabled={busy}
                  className="grid size-7 place-items-center rounded-lg border border-rose-300/20 bg-rose-300/10 text-rose-300 hover:bg-rose-300/20 disabled:opacity-50"
                  aria-label="Șterge"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
