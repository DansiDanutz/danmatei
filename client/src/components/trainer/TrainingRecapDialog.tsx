/**
 * TrainingRecapDialog — three-step flow for the trainer:
 *   1. Notes — paste 2–5 quick bullets from the session.
 *   2. Draft — AI returns a polished parent-facing recap. Trainer reviews
 *      and can edit freely (the field is just a textarea).
 *   3. Publish — saves recap to schedule_events and fans out an in-app
 *      notification + Web Push to every parent in the trainer's group.
 *
 * The first publish triggers the notification; subsequent edits only update
 * the saved text. A "Re-trimite notificarea" checkbox lets the trainer
 * explicitly fan out again on edit.
 *
 * Graceful degradation:
 *   - If OpenAI isn't configured (/recap-generate returns 503), the
 *     "Generează cu AI" button shows a friendly inline message and the
 *     trainer can still write the recap manually in the draft textarea.
 *   - If Web Push isn't configured, in-app notifications still go through.
 */
import { useEffect, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
    id: string;
    title: string;
    starts_at: string;
    recap_md: string | null;
    recap_published_at: string | null;
  };
  /** Called after a successful publish so the parent list can refresh. */
  onPublished?: () => void;
};

export default function TrainingRecapDialog({
  open,
  onOpenChange,
  event,
  onPublished,
}: Props) {
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState(event.recap_md ?? "");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [renotify, setRenotify] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  // Reset local state every time the dialog opens for a new event.
  useEffect(() => {
    if (open) {
      setNotes("");
      setDraft(event.recap_md ?? "");
      setRenotify(false);
      setAiUnavailable(false);
    }
  }, [open, event.id, event.recap_md]);

  const isFirstPublish = !event.recap_published_at;

  const generate = async () => {
    if (notes.trim().length < 5) {
      toast.error(
        "Adaugă câteva notițe despre antrenament înainte să generezi."
      );
      return;
    }
    setGenerating(true);
    setAiUnavailable(false);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sesiune expirată — autentifică-te din nou.");
        return;
      }
      const r = await fetch("/api/training/recap-generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId: event.id, notes: notes.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        recap?: string;
        error?: string;
      };
      if (r.status === 503 && j.error === "ai_not_configured") {
        setAiUnavailable(true);
        return;
      }
      if (!r.ok || !j.ok || !j.recap) {
        toast.error("Nu am putut genera recap-ul", {
          description: j.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      setDraft(j.recap);
      toast.success("Draft generat", {
        description: "Verifică textul, apoi trimite-l părinților.",
      });
    } catch (err) {
      toast.error("Eroare de rețea", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setGenerating(false);
    }
  };

  const publish = async () => {
    if (draft.trim().length < 20) {
      toast.error("Recap-ul e prea scurt — minim 20 de caractere.");
      return;
    }
    setPublishing(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sesiune expirată — autentifică-te din nou.");
        return;
      }
      const r = await fetch("/api/training/recap-publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId: event.id,
          recap: draft.trim(),
          renotify,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        notified?: number;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        toast.error("Nu am putut publica", {
          description: j.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      const sent = j.notified ?? 0;
      toast.success(
        sent > 0
          ? `Trimis către ${sent} ${sent === 1 ? "părinte" : "părinți"}`
          : "Recap salvat",
        {
          description:
            sent > 0
              ? "Părinții au primit notificare în aplicație și push (dacă au activat)."
              : "Salvat fără re-notificare.",
        }
      );
      onPublished?.();
      onOpenChange(false);
    } catch (err) {
      toast.error("Eroare de rețea", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPublishing(false);
    }
  };

  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length;
  const overWord = wordCount > 130;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] bg-[oklch(0.10_0.02_250)] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-[0.04em] text-white">
            Recap pentru părinți
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-white/65">
            <span className="text-white/85">{event.title}</span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-white/45">
              {new Date(event.starts_at).toLocaleString("ro-RO", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: trainer notes */}
          <label className="block">
            <span className="block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
              Notițele tale (3-5 idei scurte)
            </span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Am lucrat pase scurte. Andrei a marcat 2 goluri. David a muncit la presiune."
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-body text-sm text-white placeholder-white/30 outline-none focus:border-brand-cyan/45"
            />
          </label>

          <button
            type="button"
            onClick={generate}
            disabled={generating || notes.trim().length < 5}
            className="inline-flex items-center gap-2 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-4 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/20 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {draft ? "Regenerează cu AI" : "Generează cu AI"}
          </button>
          {aiUnavailable && (
            <p className="font-body text-[12px] text-white/55">
              AI-ul nu e configurat pe acest deployment. Poți scrie recap-ul
              direct în câmpul de mai jos și să-l trimiți părinților.
            </p>
          )}

          {/* Step 2: draft (AI or manual) */}
          <label className="block">
            <span className="flex items-baseline justify-between font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
              <span>Recap pentru părinți</span>
              <span
                className={`tabular-nums ${
                  overWord ? "text-rose-300" : "text-white/40"
                }`}
              >
                {wordCount} cuvinte
              </span>
            </span>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Aici apare recap-ul AI după ce apeși butonul de mai sus. Poți edita liber înainte să-l trimiți."
              rows={8}
              className={`mt-1.5 w-full rounded-xl border bg-white/[0.04] px-3 py-2 font-body text-sm text-white placeholder-white/30 outline-none focus:border-brand-cyan/45 ${
                overWord ? "border-rose-300/40" : "border-white/10"
              }`}
            />
          </label>

          {/* Re-notify toggle — only meaningful for edits to an already-
              published recap. */}
          {!isFirstPublish && (
            <label className="flex cursor-pointer items-center gap-2 font-body text-[12.5px] text-white/70">
              <input
                type="checkbox"
                checked={renotify}
                onChange={e => setRenotify(e.target.checked)}
                className="size-3.5 cursor-pointer accent-brand-cyan"
              />
              Re-trimite notificarea către părinți
            </label>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={publishing}
            className="rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-white/75 transition-colors hover:text-white disabled:opacity-50"
          >
            Renunță
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={publishing || draft.trim().length < 20}
            className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-[oklch(0.08_0.02_250)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {publishing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            {isFirstPublish ? "Trimite părinților" : "Salvează"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
