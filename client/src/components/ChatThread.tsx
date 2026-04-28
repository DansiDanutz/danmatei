/**
 * ChatThread — realtime 1:1 chat between a parent and their assigned
 * trainer (anchored on a child). Either side can open it.
 *
 * On mount we resolve-or-create the parent_trainer thread for (trainerId,
 * childId), load the most recent 100 messages, and subscribe to inserts.
 *
 * Composer is plain text + Enter-to-send. Attachments are out of scope
 * for this milestone (we have a separate signed-upload flow for media).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export interface ChatThreadProps {
  trainerId: string;
  childId: string;
  /** Display name for the counterpart (used as header label). */
  counterpartName?: string;
  className?: string;
}

interface MessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  sender?: { full_name: string | null } | null;
}

const timeFmt = new Intl.DateTimeFormat("ro-RO", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function ChatThread({
  trainerId,
  childId,
  counterpartName,
  className,
}: ChatThreadProps) {
  const { profile } = useAuth();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve-or-create thread on mount.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const existing = await supabase
        .from("chat_threads")
        .select("id")
        .eq("kind", "parent_trainer")
        .eq("trainer_id", trainerId)
        .eq("child_id", childId)
        .maybeSingle();
      if (cancelled) return;
      if (existing.data?.id) {
        setThreadId(existing.data.id);
        return;
      }
      const created = await supabase
        .from("chat_threads")
        .insert({
          kind: "parent_trainer",
          trainer_id: trainerId,
          child_id: childId,
        })
        .select("id")
        .single();
      if (cancelled) return;
      if (created.error) {
        setError(created.error.message);
        setLoading(false);
        return;
      }
      setThreadId(created.data.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [trainerId, childId, profile]);

  // Load + subscribe messages
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    void (async () => {
      const { data, error: loadErr } = await supabase
        .from("chat_messages")
        .select(
          "id, thread_id, sender_id, body, created_at, edited_at, sender:profiles!chat_messages_sender_id_fkey(full_name)",
        )
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (cancelled) return;
      if (loadErr) {
        setError(loadErr.message);
      } else {
        setMessages(((data as unknown as MessageRow[]) ?? []));
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "fotbal",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) =>
            prev.find((x) => x.id === m.id) ? prev : [...prev, m],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [threadId]);

  // Auto-scroll to bottom when a new message arrives
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onSend = useMemo(
    () => async (): Promise<void> => {
      if (!profile || !threadId) return;
      const body = draft.trim();
      if (!body) return;
      setSending(true);
      setError(null);
      const { data, error: insertErr } = await supabase
        .from("chat_messages")
        .insert({ thread_id: threadId, sender_id: profile.id, body })
        .select(
          "id, thread_id, sender_id, body, created_at, edited_at, sender:profiles!chat_messages_sender_id_fkey(full_name)",
        )
        .single();
      setSending(false);
      if (insertErr) {
        setError(insertErr.message);
        return;
      }
      // Optimistic: realtime might also fire — dedupe by id.
      if (data) {
        const inserted = data as unknown as MessageRow;
        setMessages((prev) =>
          prev.find((x) => x.id === inserted.id) ? prev : [...prev, inserted],
        );
      }
      setDraft("");
    },
    [draft, profile, threadId],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  };

  return (
    <section
      className={`flex h-[480px] flex-col overflow-hidden rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/55 ${className ?? ""}`}
      aria-label={counterpartName ? `Chat cu ${counterpartName}` : "Chat"}
    >
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="min-w-0">
          <p className="font-heading text-[10px] uppercase tracking-[0.22em] text-white/45">
            Chat 1:1
          </p>
          <h3 className="truncate font-heading text-base font-semibold text-white">
            {counterpartName ?? "Conversație"}
          </h3>
        </div>
        <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_10px_oklch(0.85_0.16_150)]" />
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <div className="grid place-items-center py-12">
            <Loader2 className="size-5 animate-spin text-brand-cyan" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-center font-body text-sm italic text-white/45">
            Începe conversația.
          </p>
        )}

        {messages.map((m) => {
          const mine = m.sender_id === profile?.id;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                  mine
                    ? "rounded-br-sm bg-brand-cyan/15 text-white"
                    : "rounded-bl-sm bg-white/[0.06] text-white"
                }`}
              >
                {!mine && m.sender?.full_name && (
                  <p className="font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan/85">
                    {m.sender.full_name}
                  </p>
                )}
                <p className="whitespace-pre-line font-body text-sm leading-relaxed">
                  {m.body}
                </p>
                <p
                  className={`mt-1 font-body text-[10px] ${
                    mine ? "text-white/55" : "text-white/40"
                  }`}
                >
                  {timeFmt.format(new Date(m.created_at))}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <footer className="border-t border-white/5 p-3">
        {error && (
          <p className="mb-2 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Scrie un mesaj…"
            className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2.5 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={sending || !draft.trim()}
            aria-label="Trimite"
            className="grid size-11 place-items-center rounded-full bg-brand-cyan text-[oklch(0.08_0.02_250)] transition-transform hover:scale-105 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </footer>
    </section>
  );
}
