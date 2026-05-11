/**
 * InboxAITab — Lead inbox for the trainer (Antrenor page tab).
 *
 * Lists leads whose `assigned_trainer_id` or `cc_trainer_ids` matches the
 * current trainer. Each card shows the AI call summary, intent, suggested
 * next steps, and quick actions (call, WhatsApp, schedule trial training,
 * play recording).
 *
 * Backed by /api/lead/list. The API derives the trainer routing slug from
 * the authenticated Supabase session; the prop is only used for the realtime
 * notification filter.
 *
 * See docs/AI_CALL_FLOW.md for the full feature design.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Loader2,
  MessageCircle,
  Phone,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useLeadRealtime } from "@/lib/use-lead-realtime";

type LeadCallSummary = {
  id: string;
  duration_seconds: number | null;
  summary: string | null;
  intent: string | null;
  next_steps: string[] | null;
  recording_url: string | null;
  status: string;
  created_at: string;
};

type Lead = {
  id: string;
  parent_name: string;
  parent_phone_e164: string;
  child_name: string;
  child_age: number;
  child_position: string | null;
  status: string;
  assigned_trainer_id: string;
  cc_trainer_ids: string[];
  created_at: string;
  latestCall: LeadCallSummary | null;
};

type Props = {
  /** Trainer slug — e.g. "t-sopi", "t-kelemen", "t-dan" */
  trainerSlug: string | null;
};

const INTENT_LABEL: Record<string, { label: string; tone: "cyan" | "gold" | "muted" }> = {
  register: { label: "Înscriere", tone: "gold" },
  visit: { label: "Programare vizită", tone: "cyan" },
  info: { label: "Informații", tone: "cyan" },
  price: { label: "Preț", tone: "gold" },
  schedule: { label: "Program", tone: "cyan" },
  other: { label: "Altele", tone: "muted" },
};

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "acum";
  if (min < 60) return `acum ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `acum ${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `acum ${d}z`;
  return date.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

function formatDuration(s: number | null | undefined): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function InboxAITab({ trainerSlug }: Props) {
  const { session } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setError("not_authenticated");
      setLeads([]);
      return;
    }

    try {
      const r = await fetch("/api/lead/list", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        items?: Lead[];
        error?: string;
      };
      if (!r.ok || !j.ok) {
        setError(typeof j.error === "string" ? j.error : `HTTP ${r.status}`);
        setLeads([]);
        return;
      }
      setLeads(j.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLeads([]);
    }
  }, [session?.access_token]);

  useEffect(() => {
    setLeads(null);
    setError(null);
    void fetchLeads();
  }, [fetchLeads]);

  // Realtime — pop a toast and refetch when a new lead lands for this trainer.
  const { status: rtStatus } = useLeadRealtime(trainerSlug, (row) => {
    const payload = row.payload as {
      leadId?: string;
      parentName?: string;
      childName?: string;
      childAge?: number;
      summary?: string;
    };
    const leadId = payload?.leadId ?? null;
    toast.success("Lead nou", {
      description: payload?.parentName
        ? `${payload.parentName} · copil ${payload.childName ?? "?"} (${payload.childAge ?? "?"} ani)`
        : "Un nou apel a fost transcris.",
      duration: 8000,
    });
    setHighlightId(leadId);
    if (leadId) setTimeout(() => setHighlightId((cur) => (cur === leadId ? null : cur)), 6000);
    void fetchLeads();
  });

  const unread = useMemo(
    () => (leads ?? []).filter((l) => l.status !== "closed" && l.status !== "contacted").length,
    [leads],
  );

  if (leads === null) {
    return (
      <div className="grid place-items-center py-16 text-white/55">
        <Loader2 className="size-5 animate-spin text-brand-cyan" />
        <span className="mt-3 font-heading text-xs uppercase tracking-[0.18em]">
          Se încarcă inbox-ul...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="font-heading text-2xl uppercase tracking-tight">
            <span className="text-white">Inbox</span>{" "}
            <span className="text-gradient-cyan">AI</span>
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Părinți care au contactat academia prin agentul AI. Te-am pus
            ca destinatar al transcrierilor pentru grupa ta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rtStatus === "live" && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.20em] text-emerald-300"
              title="Conexiune live cu serverul"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.6)] animate-pulse"
              />
              Live
            </span>
          )}
          {unread > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 border border-brand-cyan/35 px-3 py-1 font-heading text-[11px] uppercase tracking-[0.18em] text-brand-cyan">
              <Sparkles className="size-3.5" />
              {unread} necitite
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200/90 flex items-start gap-3">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-heading text-xs uppercase tracking-[0.18em] text-amber-300">
              Inbox indisponibil
            </div>
            <div className="mt-1">{error}</div>
            <div className="mt-2 text-xs text-amber-200/60">
              Verifică că variabilele Supabase sunt setate (SUPABASE_URL,
              SUPABASE_SERVICE_ROLE) și că migrația 0006 e aplicată.
            </div>
          </div>
        </div>
      )}

      {leads.length === 0 && !error && (
        <div className="rounded-2xl border border-white/10 bg-[oklch(0.10_0.02_250)] p-10 text-center">
          <div className="text-3xl mb-3">📭</div>
          <h3 className="font-heading text-lg uppercase tracking-wide text-white">
            Niciun lead încă
          </h3>
          <p className="mt-2 text-sm text-white/55">
            Când părinți noi vor cere un apel, transcrierile vor apărea aici
            în câteva minute.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {leads.map((lead) => {
          const open = openIds.has(lead.id);
          const intentMeta = lead.latestCall?.intent
            ? INTENT_LABEL[lead.latestCall.intent] ?? { label: lead.latestCall.intent, tone: "muted" as const }
            : null;
          const toneClass = (t: "cyan" | "gold" | "muted") =>
            t === "cyan"
              ? "bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan"
              : t === "gold"
                ? "bg-brand-gold/15 border-brand-gold/40 text-brand-gold"
                : "bg-white/5 border-white/15 text-white/70";

          const isHot = highlightId === lead.id;
          return (
            <li
              key={lead.id}
              className={
                "rounded-2xl border bg-[oklch(0.10_0.02_250)] p-4 sm:p-5 transition hover:border-brand-cyan/30 " +
                (isHot
                  ? "border-brand-cyan/60 shadow-[0_0_0_1px_oklch(0.78_0.13_210/0.5),0_0_40px_-5px_oklch(0.78_0.13_210/0.55)] animate-pulse"
                  : "border-white/10")
              }
            >
              <header className="flex items-start gap-3">
                <div className="size-10 rounded-full bg-brand-cyan/15 border border-brand-cyan/40 grid place-items-center font-heading text-xs text-brand-cyan">
                  {lead.parent_name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((s) => s[0]?.toUpperCase())
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-heading text-lg text-white truncate">
                      {lead.parent_name}
                    </h3>
                    <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-white/45 shrink-0">
                      {formatRelative(lead.created_at)}
                    </span>
                  </div>
                  <div className="text-xs text-white/55 mt-0.5">
                    Părinte ·{" "}
                    <span className="text-white/80">{lead.child_name}</span>{" "}
                    · {lead.child_age} ani
                    {lead.child_position ? ` · ${lead.child_position}` : ""}
                  </div>
                </div>
              </header>

              {lead.latestCall && (
                <section className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="size-3.5 text-brand-cyan" />
                    <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-brand-cyan">
                      Rezumat AI
                    </span>
                    <span className="ml-auto text-[10px] text-white/40 font-mono">
                      {formatDuration(lead.latestCall.duration_seconds)}
                    </span>
                  </div>
                  <p className="text-sm text-white/85 leading-relaxed">
                    {lead.latestCall.summary ?? "Transcriere nedisponibilă."}
                  </p>

                  {intentMeta && (
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-heading text-[10px] uppercase tracking-[0.16em] ${toneClass(intentMeta.tone)}`}
                      >
                        {intentMeta.label}
                      </span>
                    </div>
                  )}

                  {lead.latestCall.next_steps?.length ? (
                    <ul className="mt-3 space-y-1.5">
                      {lead.latestCall.next_steps.map((step, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-[13px] text-white/80"
                        >
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-cyan/70" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              )}

              <footer className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={`tel:${lead.parent_phone_e164}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-cyan text-[oklch(0.08_0.02_250)] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] hover:opacity-90"
                >
                  <Phone className="size-3.5" />
                  Sună
                </a>
                <a
                  href={`https://wa.me/${lead.parent_phone_e164.replace(/^\+/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] border border-white/12 text-white/85 px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] hover:bg-white/[0.10]"
                >
                  <MessageCircle className="size-3.5" />
                  WhatsApp
                </a>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] border border-white/12 text-white/85 px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] hover:bg-white/[0.10]"
                >
                  <Calendar className="size-3.5" />
                  Programează
                </button>
                {lead.latestCall?.recording_url && (
                  <a
                    href={lead.latestCall.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 ml-auto text-xs text-brand-cyan hover:underline"
                  >
                    <PlayCircle className="size-4" />
                    Ascultă apel
                  </a>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setOpenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(lead.id)) next.delete(lead.id);
                      else next.add(lead.id);
                      return next;
                    })
                  }
                  className="text-xs text-white/55 hover:text-white/80 ml-auto"
                >
                  {open ? "Ascunde detalii" : "Detalii"}
                </button>
              </footer>

              {open && (
                <pre className="mt-3 rounded-xl bg-black/40 border border-white/8 p-3 text-[11px] text-white/65 whitespace-pre-wrap font-mono overflow-x-auto">
                  {JSON.stringify(
                    {
                      lead_id: lead.id,
                      status: lead.status,
                      assigned: lead.assigned_trainer_id,
                      cc: lead.cc_trainer_ids,
                      latest_call: lead.latestCall,
                    },
                    null,
                    2,
                  )}
                </pre>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35 text-center pt-2">
        Trainer slug: <span className="text-white/55">{trainerSlug ?? "auto"}</span>{" "}
        · Datele se actualizează la fiecare apel finalizat
      </p>
    </div>
  );
}
