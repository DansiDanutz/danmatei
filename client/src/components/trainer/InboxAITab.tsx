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
  Bell,
  BellOff,
  Calendar,
  Check,
  CheckCheck,
  Clock,
  EyeOff,
  Loader2,
  MessageCircle,
  Phone,
  PlayCircle,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useBrowserNotification } from "@/lib/use-browser-notification";
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
  snoozed_until: string | null;
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

type StatusFilter = "all" | "new" | "contacted" | "closed";

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Toate",
  new: "Noi",
  contacted: "Contactate",
  closed: "Închise",
};

const ACTIVE_STATUSES: ReadonlyArray<string> = [
  "new",
  "wa_sent",
  "calling",
  "transcribed",
  "routed",
];

function bucketOf(status: string): "new" | "contacted" | "closed" {
  if (status === "contacted") return "contacted";
  if (status === "closed") return "closed";
  return "new";
}

export default function InboxAITab({ trainerSlug }: Props) {
  const { session } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const browserNotif = useBrowserNotification();

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
    const description = payload?.parentName
      ? `${payload.parentName} · copil ${payload.childName ?? "?"} (${payload.childAge ?? "?"} ani)`
      : "Un nou apel a fost transcris.";

    toast.success("Lead nou", { description, duration: 8000 });

    // Fire a native browser Notification too, so the trainer still sees the
    // lead when they have the inbox tab open in another window/desktop.
    // The hook auto-suppresses if the tab is visible — no double-ping.
    browserNotif.notify({
      title: "Lead nou — Academia Dan Matei",
      body: description,
      tag: leadId ?? undefined,
      onClick: () => {
        // Highlight the lead in the list when the user clicks the OS toast.
        if (leadId) setHighlightId(leadId);
      },
    });

    setHighlightId(leadId);
    if (leadId) setTimeout(() => setHighlightId((cur) => (cur === leadId ? null : cur)), 6000);
    void fetchLeads();
  });

  const unread = useMemo(
    () => (leads ?? []).filter((l) => l.status !== "closed" && l.status !== "contacted").length,
    [leads],
  );

  const counts = useMemo(() => {
    const c = { all: 0, new: 0, contacted: 0, closed: 0 };
    for (const l of leads ?? []) {
      c.all += 1;
      c[bucketOf(l.status)] += 1;
    }
    return c;
  }, [leads]);

  const nowIso = useMemo(() => new Date().toISOString(), [leads]);

  // Active snoozes hide the lead from the inbox by default. Auto-expires
  // when the timestamp passes — no scheduled job needed.
  const isSnoozed = useCallback(
    (l: Lead) => !!l.snoozed_until && l.snoozed_until > nowIso,
    [nowIso]
  );

  const snoozedCount = useMemo(
    () => (leads ?? []).filter(isSnoozed).length,
    [leads, isSnoozed]
  );

  const visibleLeads = useMemo(() => {
    const all = leads ?? [];
    let rows = showSnoozed ? all : all.filter(l => !isSnoozed(l));
    if (filter !== "all") rows = rows.filter(l => bucketOf(l.status) === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(l => {
        return (
          l.parent_name.toLowerCase().includes(q) ||
          l.child_name.toLowerCase().includes(q) ||
          l.parent_phone_e164.toLowerCase().includes(q)
        );
      });
    }
    return rows;
  }, [leads, filter, search, showSnoozed, isSnoozed]);

  // Drop selections that are no longer visible (filter / search change).
  useEffect(() => {
    if (selected.size === 0) return;
    const visibleIds = new Set(visibleLeads.map(l => l.id));
    const next = new Set(Array.from(selected).filter(id => visibleIds.has(id)));
    if (next.size !== selected.size) setSelected(next);
  }, [visibleLeads, selected]);

  const updateStatus = useCallback(
    async (leadId: string, next: "routed" | "contacted" | "closed") => {
      const token = session?.access_token;
      if (!token) {
        toast.error("Sesiune expirată — autentifică-te din nou.");
        return;
      }
      setUpdatingId(leadId);
      // Optimistic update
      setLeads((prev) =>
        prev ? prev.map((l) => (l.id === leadId ? { ...l, status: next } : l)) : prev,
      );
      try {
        const r = await fetch("/api/lead/status", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id: leadId, status: next }),
        });
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!r.ok || !j.ok) {
          toast.error("Nu am putut actualiza", {
            description: j.error ?? `HTTP ${r.status}`,
          });
          // Revert on failure
          await fetchLeads();
        } else {
          const friendly =
            next === "contacted"
              ? "Marcat ca răspuns"
              : next === "closed"
                ? "Lead închis"
                : "Repus în lucru";
          toast.success(friendly);
        }
      } catch (err) {
        toast.error("Eroare de rețea", {
          description: err instanceof Error ? err.message : String(err),
        });
        await fetchLeads();
      } finally {
        setUpdatingId(null);
      }
    },
    [session?.access_token, fetchLeads],
  );

  const snoozeLead = useCallback(
    async (leadId: string, hours: number | null) => {
      const token = session?.access_token;
      if (!token) return;
      const next = hours === null ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
      setUpdatingId(leadId);
      // Optimistic
      setLeads(prev =>
        prev
          ? prev.map(l => (l.id === leadId ? { ...l, snoozed_until: next } : l))
          : prev
      );
      try {
        const r = await fetch("/api/lead/status", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id: leadId, snoozedUntil: next }),
        });
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!r.ok || !j.ok) {
          toast.error("Nu am putut amâna", {
            description: j.error ?? `HTTP ${r.status}`,
          });
          await fetchLeads();
        } else {
          toast.success(
            hours === null ? "Amânare anulată" : `Amânat ${hours}h`
          );
        }
      } catch (err) {
        toast.error("Eroare de rețea", {
          description: err instanceof Error ? err.message : String(err),
        });
        await fetchLeads();
      } finally {
        setUpdatingId(null);
      }
    },
    [session?.access_token, fetchLeads]
  );

  const bulkUpdate = useCallback(
    async (next: "contacted" | "closed") => {
      const token = session?.access_token;
      if (!token || selected.size === 0) return;
      const ids = Array.from(selected);
      setBulkBusy(true);
      // Optimistic
      setLeads(prev =>
        prev
          ? prev.map(l => (selected.has(l.id) ? { ...l, status: next } : l))
          : prev
      );
      try {
        const r = await fetch("/api/lead/status", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids, status: next }),
        });
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          updated?: string[];
          denied?: string[];
          error?: string;
        };
        if (!r.ok || !j.ok) {
          toast.error("Nu am putut actualiza în bloc", {
            description: j.error ?? `HTTP ${r.status}`,
          });
          await fetchLeads();
        } else {
          const updated = j.updated?.length ?? ids.length;
          const denied = j.denied?.length ?? 0;
          const friendly = next === "contacted" ? "Marcate ca răspuns" : "Închise";
          toast.success(`${updated} lead-uri · ${friendly}`, {
            description:
              denied > 0
                ? `${denied} lead-uri au fost ignorate (fără permisiune).`
                : undefined,
          });
          setSelected(new Set());
        }
      } catch (err) {
        toast.error("Eroare de rețea", {
          description: err instanceof Error ? err.message : String(err),
        });
        await fetchLeads();
      } finally {
        setBulkBusy(false);
      }
    },
    [session?.access_token, selected, fetchLeads]
  );

  const toggleSelect = useCallback((leadId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(visibleLeads.map(l => l.id)));
  }, [visibleLeads]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const waLinkFor = (lead: Lead): string => {
    const phone = lead.parent_phone_e164.replace(/^\+/, "");
    const opener = `Bună, ${lead.parent_name}! 👋 Sunt antrenorul ${lead.child_name} (${lead.child_age} ani) de la Academia Dan Matei. Am ascultat apelul tău și aș vrea să stabilim primul antrenament.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(opener)}`;
  };

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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Browser-notification opt-in. Only shown when the API is
              supported and we haven't already been granted/denied. */}
          {browserNotif.supported && browserNotif.permission === "default" && (
            <button
              type="button"
              onClick={() => {
                void browserNotif.request().then((next) => {
                  if (next === "granted") {
                    toast.success("Notificările sunt active", {
                      description:
                        "Vei primi o notificare pe desktop când vine un lead nou și nu ești pe această filă.",
                    });
                  } else if (next === "denied") {
                    toast.error("Notificările au fost blocate", {
                      description:
                        "Le poți activa din setările browserului (lacăt în bara de adresă).",
                    });
                  }
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/35 px-3 py-1 font-heading text-[11px] uppercase tracking-[0.18em] text-brand-cyan hover:bg-brand-cyan/20 transition"
              title="Activează notificările desktop pentru lead-uri noi"
            >
              <Bell className="size-3.5" />
              Activează notificările
            </button>
          )}
          {browserNotif.permission === "granted" && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/12 px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.20em] text-white/70"
              title="Notificările desktop sunt active"
            >
              <Bell className="size-3" />
              Notificări ON
            </span>
          )}
          {browserNotif.permission === "denied" && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/10 px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.20em] text-white/45"
              title="Notificările sunt blocate — activează-le din setările browserului"
            >
              <BellOff className="size-3" />
              Blocate
            </span>
          )}
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

      {/* Search + snoozed toggle */}
      {leads.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-1 min-w-[200px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 transition focus-within:border-brand-cyan/40">
            <Search className="size-3.5 text-white/45" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Caută părinte, copil sau telefon"
              aria-label="Caută în lead-uri"
              className="flex-1 bg-transparent font-body text-sm text-white placeholder-white/40 outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Șterge căutarea"
                className="text-white/45 transition-colors hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
          {snoozedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowSnoozed(s => !s)}
              aria-pressed={showSnoozed}
              className={
                showSnoozed
                  ? "inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/15 px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.14em] text-brand-cyan"
                  : "inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.14em] text-white/65 transition-colors hover:border-brand-cyan/30 hover:text-white"
              }
            >
              <EyeOff className="size-3.5" />
              {showSnoozed ? "Ascunde amânate" : `Arată amânate (${snoozedCount})`}
            </button>
          )}
        </div>
      )}

      {/* Bulk action bar — visible only when 1+ leads selected */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-cyan/35 bg-brand-cyan/[0.08] px-4 py-2.5">
          <span className="font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan">
            {selected.size} {selected.size === 1 ? "selectat" : "selectate"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void bulkUpdate("contacted")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/45 bg-brand-cyan/15 px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/25 disabled:opacity-60"
            >
              {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Marchează ca răspuns
            </button>
            <button
              type="button"
              onClick={() => void bulkUpdate("closed")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-white/80 transition-colors hover:border-rose-300/40 hover:text-rose-200 disabled:opacity-60"
            >
              {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
              Închide
            </button>
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={bulkBusy || selected.size === visibleLeads.length}
              className="font-heading text-[10.5px] uppercase tracking-[0.14em] text-white/55 hover:text-white disabled:opacity-50"
            >
              Tot vizibilul
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={bulkBusy}
              className="font-heading text-[10.5px] uppercase tracking-[0.14em] text-white/55 hover:text-white disabled:opacity-50"
            >
              Renunță
            </button>
          </div>
        </div>
      )}

      {/* Filter pills */}
      {leads.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/8 p-1 self-start">
          {(["all", "new", "contacted", "closed"] as StatusFilter[]).map((k) => {
            const active = filter === k;
            const count = counts[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-heading text-[11px] uppercase tracking-[0.16em] transition ${
                  active
                    ? "bg-brand-cyan text-[oklch(0.08_0.02_250)]"
                    : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {FILTER_LABELS[k]}
                <span
                  className={`min-w-[1.5em] text-center rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    active
                      ? "bg-[oklch(0.08_0.02_250)]/15 text-[oklch(0.08_0.02_250)]"
                      : "bg-white/[0.06] text-white/60"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <ul className="space-y-3">
        {visibleLeads.length === 0 && leads.length > 0 && (
          <li className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-center text-sm text-white/55">
            Niciun lead în această categorie.
          </li>
        )}
        {visibleLeads.map((lead) => {
          const open = openIds.has(lead.id);
          const bucket = bucketOf(lead.status);
          const isUpdating = updatingId === lead.id;
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
                <input
                  type="checkbox"
                  checked={selected.has(lead.id)}
                  onChange={() => toggleSelect(lead.id)}
                  aria-label={`Selectează lead ${lead.parent_name}`}
                  className="mt-3 size-4 shrink-0 cursor-pointer accent-brand-cyan"
                />
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
                  {isSnoozed(lead) && lead.snoozed_until && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] px-2 py-0.5 font-heading text-[9.5px] uppercase tracking-[0.16em] text-white/55">
                      <Clock className="size-3" />
                      Amânat până{" "}
                      {new Date(lead.snoozed_until).toLocaleString("ro-RO", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
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

              {/* Inline audio player for the recording */}
              {lead.latestCall?.recording_url && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <PlayCircle className="size-4 text-brand-cyan shrink-0" />
                  <audio
                    controls
                    preload="none"
                    src={lead.latestCall.recording_url}
                    className="h-8 w-full"
                  />
                </div>
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
                  href={waLinkFor(lead)}
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

                {/* Status workflow buttons */}
                {bucket === "new" && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateStatus(lead.id, "contacted")}
                      disabled={isUpdating}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold/15 border border-brand-gold/35 text-brand-gold px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] hover:bg-brand-gold/25 disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Răspuns dat
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(lead.id, "closed")}
                      disabled={isUpdating}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/12 text-white/65 px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      <CheckCheck className="size-3.5" />
                      Închide
                    </button>
                  </>
                )}
                {bucket === "contacted" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(lead.id, "closed")}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] hover:bg-brand-cyan/20 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                    Închide
                  </button>
                )}
                {bucket === "closed" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(lead.id, "routed")}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/12 text-white/65 px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                    Redeschide
                  </button>
                )}
                {/* Snooze — hides the lead from the inbox until the timestamp
                 *  passes. Toggles to "Anulează amânare" when already snoozed. */}
                {isSnoozed(lead) ? (
                  <button
                    type="button"
                    onClick={() => snoozeLead(lead.id, null)}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-cyan/30 bg-brand-cyan/[0.08] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/15 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
                    Anulează amânare
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => snoozeLead(lead.id, 24)}
                    disabled={isUpdating}
                    aria-label="Amână 24 de ore"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-white/65 transition-colors hover:border-brand-cyan/30 hover:text-white disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
                    Amână 24h
                  </button>
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
