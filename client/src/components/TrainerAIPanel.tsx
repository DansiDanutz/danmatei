/**
 * TrainerAIPanel — block rendered inside /antrenor that lets the trainer:
 *   - Edit their WhatsApp number + ElevenLabs agent id (the agent that
 *     greets parents who sign up to their group)
 *   - Read the transcripts of conversations parents had with that agent
 */
import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, MessageCircle, Phone, Save } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { expoOut } from "@/lib/motion";

export interface TrainerAIPanelProps {
  trainerId: string;
  initialWhatsapp: string | null;
  initialAgentId: string | null;
  onSaved?: (next: { whatsapp_number: string | null; elevenlabs_agent_id: string | null }) => void;
}

interface ConvoRow {
  id: string;
  child_id: string | null;
  parent_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  transcript_md: string | null;
  transcript_summary: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  share_link: string;
  created_at: string;
  ended_at: string | null;
  parent: { full_name: string } | null;
  child: { full_name: string } | null;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function TrainerAIPanel({
  trainerId,
  initialWhatsapp,
  initialAgentId,
  onSaved,
}: TrainerAIPanelProps) {
  const [whatsapp, setWhatsapp] = useState<string>(initialWhatsapp ?? "");
  const [agentId, setAgentId] = useState<string>(initialAgentId ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [convos, setConvos] = useState<ConvoRow[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useMemo(
    () => async () => {
      setLoadingConvos(true);
      const { data, error: convoErr } = await supabase
        .from("ai_conversations")
        .select(
          "id, child_id, parent_id, status, transcript_md, transcript_summary, duration_seconds, recording_url, share_link, created_at, ended_at, parent:profiles!ai_conversations_parent_id_fkey(full_name), child:children!ai_conversations_child_id_fkey(full_name)",
        )
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (convoErr) {
        setError(convoErr.message);
      } else {
        setConvos((data as unknown as ConvoRow[]) ?? []);
      }
      setLoadingConvos(false);
    },
    [trainerId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const next = {
      whatsapp_number: whatsapp.trim() || null,
      elevenlabs_agent_id: agentId.trim() || null,
    };
    const { error: updErr } = await supabase
      .from("trainers")
      .update(next)
      .eq("id", trainerId);
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setSavedAt(new Date());
    onSaved?.(next);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3" id="transcripte">
      {/* Settings card */}
      <form
        onSubmit={onSave}
        className="grid gap-3 self-start rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5"
      >
        <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
          Contact & Asistent AI
        </h2>

        <label className="grid gap-1.5">
          <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            <Phone className="mr-1 inline size-3.5 text-brand-cyan" />
            Număr WhatsApp
          </span>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+40744311147"
            className="rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
          />
          <span className="font-body text-[11px] text-white/45">
            Părinții te contactează aici după ce primesc rezumatul conversației AI.
          </span>
        </label>

        <label className="grid gap-1.5">
          <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            <Bot className="mr-1 inline size-3.5 text-brand-cyan" />
            ElevenLabs Agent ID (opțional)
          </span>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="agent_xxx (lasă gol pentru asistentul implicit)"
            className="rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
          />
        </label>

        {error && (
          <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
            {error}
          </p>
        )}
        {savedAt && !error && (
          <p className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 font-body text-xs text-emerald-200">
            Salvat {savedAt.toLocaleTimeString("ro-RO", { timeZone: "Europe/Bucharest" })}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="touch-target inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvează
        </button>
      </form>

      {/* Transcripts */}
      <div className="lg:col-span-2">
        <header className="flex items-center justify-between gap-3 px-1">
          <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
            Transcripte AI
          </h2>
          <span className="font-body text-[11px] text-white/45">
            {convos.length} conversații
          </span>
        </header>

        {loadingConvos && (
          <div className="grid place-items-center py-12">
            <Loader2 className="size-5 animate-spin text-brand-cyan" />
          </div>
        )}

        {!loadingConvos && convos.length === 0 && (
          <div className="mt-3 grid place-items-center rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/40 py-12 text-center">
            <MessageCircle className="size-7 text-brand-cyan" />
            <p className="mt-3 font-heading text-sm uppercase tracking-wider text-white">
              Nu există încă transcripte
            </p>
            <p className="mt-1 max-w-md font-body text-xs text-white/55">
              După ce un părinte semnează contractul digital, primește pe WhatsApp un link către asistentul vocal AI. Transcriptul apare aici după conversație.
            </p>
          </div>
        )}

        <div className="mt-3 space-y-3">
          {convos.map((c, i) => {
            const open = openId === c.id;
            const dur = c.duration_seconds
              ? `${Math.round(c.duration_seconds)}s`
              : "—";
            return (
              <motion.article
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.03, ease: expoOut }}
                className="overflow-hidden rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/55"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.02]"
                  aria-expanded={open}
                >
                  <div className="min-w-0">
                    <p className="font-heading text-sm font-semibold uppercase tracking-[0.04em] text-white">
                      {c.parent?.full_name ?? "Părinte"}
                      {c.child?.full_name && (
                        <span className="ml-2 text-white/55">
                          · {c.child.full_name}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 font-body text-[11px] text-white/45">
                      {dateFormatter.format(new Date(c.ended_at ?? c.created_at))}
                      {" · "}
                      <span className="text-white/60">{dur}</span>
                    </p>
                    {c.transcript_summary && (
                      <p className="mt-2 font-body text-sm text-white/70 line-clamp-2">
                        {c.transcript_summary}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.18em] ${statusStyle(c.status)}`}
                  >
                    {statusLabel(c.status)}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-white/5 p-4 text-sm leading-relaxed text-white/80">
                    {c.transcript_md ? (
                      <div className="whitespace-pre-line font-body">
                        {c.transcript_md}
                      </div>
                    ) : (
                      <p className="font-body text-white/55">
                        Nu există transcript încă. Părintele are linkul:{" "}
                        <a
                          href={c.share_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-cyan underline-offset-2 hover:underline"
                        >
                          deschide
                        </a>
                      </p>
                    )}
                    {c.recording_url && (
                      <audio
                        controls
                        src={c.recording_url}
                        className="mt-3 w-full"
                      />
                    )}
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function statusLabel(s: ConvoRow["status"]): string {
  switch (s) {
    case "pending":
      return "În așteptare";
    case "in_progress":
      return "În curs";
    case "completed":
      return "Finalizată";
    case "failed":
      return "Eșuată";
  }
}

function statusStyle(s: ConvoRow["status"]): string {
  switch (s) {
    case "completed":
      return "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan";
    case "in_progress":
      return "border-brand-gold/30 bg-brand-gold/10 text-brand-gold";
    case "failed":
      return "border-rose-400/25 bg-rose-400/10 text-rose-300";
    default:
      return "border-white/15 bg-white/5 text-white/60";
  }
}
