/**
 * /copil/:childId — child profile with 5 tabs:
 *   1. Profil  — basic info + edit + photo gallery (parent uploads)
 *   2. Știri   — news visible to this child (audience: members + group match)
 *   3. Program — upcoming schedule_events for the child's trainer
 *   4. Arhivă  — past events + match_participations
 *   5. Istoric — vertical timeline of player_events (newest first)
 *
 * RLS in the DB enforces who can read what — so each query is intentionally
 * loose; the policy filters rows. The page is shared by parent (their own
 * child), assigned trainer, and owner.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  CalendarDays,
  Check,
  ChevronRight,
  ImagePlus,
  Loader2,
  MessageSquare,
  Newspaper,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import MemberShell from "@/components/MemberShell";
import PlayerStatsHeader from "@/components/player/PlayerStatsHeader";
import { supabase } from "@/lib/supabase";
import { currentAge, formatTimelineDate } from "@/lib/age";
import { useAuth } from "@/lib/auth";

type Child = {
  id: string;
  parent_id: string;
  full_name: string;
  dob: string;
  gender: string | null;
  photo_path: string | null;
  school: string | null;
  medical_notes: string | null;
  trainer_id: string | null;
  age_group_label: string | null;
  status: "active" | "paused" | "left";
  created_at: string;
};

type PlayerEvent = {
  id: string;
  kind: string;
  title: string;
  body_md: string | null;
  occurred_at: string;
};

type ScheduleRow = {
  id: string;
  kind: "training" | "match" | "tournament" | "other";
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  opponent: string | null;
  notes: string | null;
  recap_md: string | null;
  recap_published_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
};

type NewsRow = {
  id: string;
  title: string;
  body_md: string;
  audience: "public" | "members" | "group";
  group_trainer_id: string | null;
  published_at: string | null;
};

type MediaRow = {
  id: string;
  storage_path: string;
  kind: "image" | "video";
  caption: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  audience: "group" | "child" | "parent";
  body_md: string;
  created_at: string;
  trainer: { profile: { full_name: string } | null } | null;
};

type ParticipationRow = {
  id: string;
  goals: number;
  assists: number;
  role: string;
  event: {
    id: string;
    title: string;
    starts_at: string;
    opponent: string | null;
  };
  result: { our_score: number; opponent_score: number } | null;
};

const KIND_LABEL: Record<string, string> = {
  signup: "Înscriere",
  profile_update: "Profil actualizat",
  group_assigned: "Repartizare grupă",
  group_unassigned: "Schimb grupă",
  match: "Meci",
  training: "Antrenament",
  achievement: "Realizare",
  note: "Notă antrenor",
  media: "Medii încărcate",
  status_change: "Status",
};

export default function CopilProfil() {
  const [, params] = useRoute<{ childId: string }>("/copil/:childId");
  const childId = params?.childId;
  const { profile } = useAuth();
  const [child, setChild] = useState<Child | null>(null);
  const [events, setEvents] = useState<PlayerEvent[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [news, setNews] = useState<NewsRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [participations, setParticipations] = useState<ParticipationRow[]>([]);
  const [siblings, setSiblings] = useState<{ id: string; full_name: string }[]>(
    []
  );
  // Per-event attendance status keyed by event_id. Powers the parent's
  // inline RSVP pills on upcoming training rows.
  const [attendance, setAttendance] = useState<
    Map<string, "present" | "absent" | "late" | "excused">
  >(new Map());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const c = await supabase
        .from("children")
        .select(
          "id, parent_id, full_name, dob, gender, photo_path, school, medical_notes, trainer_id, age_group_label, status, created_at"
        )
        .eq("id", childId)
        .maybeSingle();
      if (cancelled) return;
      if (c.error) {
        setError(c.error.message);
        setLoading(false);
        return;
      }
      if (!c.data) {
        setError("Copilul nu a fost găsit sau nu ai dreptul să-l vezi.");
        setLoading(false);
        return;
      }
      const childData = c.data as Child;
      setChild(childData);

      const [pe, sch, nw, md, pa, msg] = await Promise.all([
        supabase
          .from("player_events")
          .select("id, kind, title, body_md, occurred_at")
          .eq("child_id", childId)
          .order("occurred_at", { ascending: false })
          .limit(100),
        childData.trainer_id
          ? supabase
              .from("schedule_events")
              .select(
                "id, kind, title, starts_at, ends_at, location, opponent, notes, recap_md, recap_published_at, cancelled_at, cancelled_reason"
              )
              .eq("trainer_id", childData.trainer_id)
              .order("starts_at", { ascending: true })
          : Promise.resolve({ data: [], error: null } as const),
        supabase
          .from("news")
          .select(
            "id, title, body_md, audience, group_trainer_id, published_at"
          )
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(30),
        supabase
          .from("media")
          .select("id, storage_path, kind, caption, created_at")
          .eq("child_id", childId)
          .order("created_at", { ascending: false }),
        supabase
          .from("match_participations")
          .select(
            "id, goals, assists, role, event:schedule_events(id, title, starts_at, opponent), result:match_results(our_score, opponent_score)"
          )
          .eq("child_id", childId)
          .order("created_at", { ascending: false }),
        childData.trainer_id
          ? supabase
              .from("messages")
              .select(
                "id, audience, body_md, created_at, trainer:trainers!messages_trainer_id_fkey(profile:profiles!trainers_profile_id_fkey(full_name))"
              )
              .eq("trainer_id", childData.trainer_id)
              .or(
                `audience.eq.group,and(audience.in.(child,parent),child_id.eq.${childId})`
              )
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null } as const),
      ]);

      if (cancelled) return;
      setEvents((pe.data ?? []) as PlayerEvent[]);
      setSchedule((sch.data ?? []) as ScheduleRow[]);
      setNews((nw.data ?? []) as NewsRow[]);
      setMedia((md.data ?? []) as MediaRow[]);
      setMessages((msg.data ?? []) as unknown as MessageRow[]);
      setParticipations((pa.data ?? []) as unknown as ParticipationRow[]);

      // Pull this child's attendance rows for the events we just loaded so
      // the parent's RSVP pills know their last answer.
      const eventIds = ((sch.data ?? []) as { id: string }[]).map(s => s.id);
      if (eventIds.length > 0) {
        const { data: attRows } = await supabase
          .from("attendance")
          .select("event_id, status")
          .eq("child_id", childId)
          .in("event_id", eventIds);
        if (!cancelled) {
          const map = new Map<
            string,
            "present" | "absent" | "late" | "excused"
          >();
          (
            (attRows ?? []) as {
              event_id: string;
              status: "present" | "absent" | "late" | "excused";
            }[]
          ).forEach(r => map.set(r.event_id, r.status));
          setAttendance(map);
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [childId]);

  // Parent's RSVP for an upcoming training. POSTs to /api/attendance/confirm
  // which upserts an attendance row; the trainer can override on the day.
  const confirmAttendance = useCallback(
    async (eventId: string, coming: boolean) => {
      if (!childId) return;
      setConfirmingId(eventId);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          toast.error("Sesiune expirată — autentifică-te din nou.");
          return;
        }
        const r = await fetch("/api/attendance/confirm", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ childId, eventId, coming }),
        });
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          status?: "present" | "absent";
          error?: string;
        };
        if (!r.ok || !j.ok || !j.status) {
          toast.error("Nu am putut confirma", {
            description: j.error ?? `HTTP ${r.status}`,
          });
          return;
        }
        setAttendance(prev => {
          const next = new Map(prev);
          next.set(eventId, j.status!);
          return next;
        });
        toast.success(coming ? "Mulțumim — vine!" : "OK, am notat absența");
      } catch (err) {
        toast.error("Eroare de rețea", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setConfirmingId(null);
      }
    },
    [childId]
  );

  // Honor ?confirm=<eventId> from a push notification — scroll the matching
  // schedule card into view and add a brief highlight ring.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("confirm");
    if (!target) return;
    const t = setTimeout(() => {
      const el = document.querySelector(
        `[data-event-id="${target}"]`
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-brand-cyan", "ring-offset-0");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-brand-cyan", "ring-offset-0");
        }, 4000);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [schedule]);

  // Fetch siblings only for the parent — used to render the kid-switcher above
  // the player header when the parent has 2+ kids. RLS restricts the query to
  // the current parent's own children, so this is cheap and safe.
  useEffect(() => {
    if (!child || !profile || profile.id !== child.parent_id) {
      setSiblings([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("children")
      .select("id, full_name")
      .eq("parent_id", profile.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setSiblings((data ?? []) as { id: string; full_name: string }[]);
      });
    return () => {
      cancelled = true;
    };
  }, [child, profile]);

  const age = useMemo(() => (child ? currentAge(child.dob) : null), [child]);

  const upcoming = useMemo(
    () => schedule.filter(s => new Date(s.starts_at) >= new Date()),
    [schedule]
  );
  const past = useMemo(
    () => schedule.filter(s => new Date(s.starts_at) < new Date()),
    [schedule]
  );

  const childNews = useMemo(() => {
    if (!child) return [];
    return news.filter(n => {
      if (n.audience === "public") return true;
      if (n.audience === "members") return true; // user is auth'd (parent)
      if (n.audience === "group") {
        return n.group_trainer_id === child.trainer_id;
      }
      return false;
    });
  }, [news, child]);

  if (!childId) return null;

  if (loading) {
    return (
      <MemberShell>
        <div className="grid place-items-center py-24">
          <Loader2 className="size-5 animate-spin text-brand-cyan" />
        </div>
      </MemberShell>
    );
  }

  if (error || !child) {
    return (
      <MemberShell>
        <div className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-8 text-center">
          <h1 className="font-heading text-2xl font-bold uppercase">
            Acces interzis
          </h1>
          <p className="mt-2 font-body text-sm text-white/65">
            {error ?? "Copilul nu a fost găsit."}
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 font-heading text-[11px] uppercase tracking-[0.18em] text-white/75 hover:text-white"
          >
            Înapoi la dashboard
          </Link>
        </div>
      </MemberShell>
    );
  }

  const isParent = profile?.id === child.parent_id;

  return (
    <MemberShell>
      {/* Sibling switcher — visible only to parents with 2+ kids. Lets a
       *  multi-child family hop between profiles without going back to /copii. */}
      {isParent && siblings.length > 1 && (
        <nav
          aria-label="Copiii tăi"
          className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/55 p-2.5"
        >
          <span className="inline-flex items-center gap-1.5 px-2 font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            <Users className="size-3.5 text-brand-cyan/80" />
            Copiii tăi
          </span>
          {siblings.map(s => {
            const isCurrent = s.id === child.id;
            return (
              <Link
                key={s.id}
                href={`/copil/${s.id}`}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "inline-flex items-center gap-1 rounded-full border border-brand-cyan/45 bg-brand-cyan/15 px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan"
                    : "inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-brand-cyan/40 hover:text-white"
                }
              >
                {s.full_name.split(" ")[0]}
                {!isCurrent && <ChevronRight className="size-3" />}
              </Link>
            );
          })}
          <Link
            href="/inregistrare/copil"
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-dashed border-white/12 bg-white/[0.02] px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.16em] text-white/55 transition-colors hover:border-brand-cyan/40 hover:text-brand-cyan"
          >
            + Adaugă copil
          </Link>
        </nav>
      )}

      {/* Premium player header — stats + skill tree */}
      <PlayerStatsHeader
        child={child}
        onPhotoChanged={newPath =>
          setChild(prev => (prev ? { ...prev, photo_path: newPath } : prev))
        }
      />

      {/* Original header card (info + status + edit) */}
      <section className="mt-5 rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-full border border-brand-cyan/30 bg-gradient-to-br from-[oklch(0.55_0.13_230)] via-[oklch(0.32_0.10_230)] to-[oklch(0.18_0.06_240)] font-heading text-xl font-bold text-white">
              {child.full_name
                .split(" ")
                .map(p => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <span className="font-heading text-[10px] uppercase tracking-[0.22em] text-brand-cyan/80">
                Profil jucător
              </span>
              <h1 className="font-heading text-3xl font-bold uppercase leading-[1.05] tracking-[0.02em] text-white sm:text-4xl">
                {child.full_name}
              </h1>
              <p className="mt-0.5 font-body text-sm text-white/55">
                {age != null && `${age} ani`}
                {child.age_group_label && ` · Grupa ${child.age_group_label}`}
                {child.school && ` · ${child.school}`}
              </p>
            </div>
          </div>

          <span
            className={`rounded-full border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] ${
              child.status === "active"
                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                : "border-white/15 bg-white/5 text-white/60"
            }`}
          >
            {child.status === "active" ? "Activ" : child.status}
          </span>
        </div>
      </section>

      {/* Tabs */}
      <Tabs defaultValue="profil" className="mt-6">
        <TabsList className="flex w-full gap-1 overflow-x-auto rounded-full border border-white/8 bg-[oklch(0.10_0.02_250)] p-1">
          <Trigger value="profil" icon={<UserRound className="size-3.5" />}>
            Profil
          </Trigger>
          <Trigger value="stiri" icon={<Newspaper className="size-3.5" />}>
            Știri
          </Trigger>
          <Trigger value="program" icon={<CalendarDays className="size-3.5" />}>
            Program
          </Trigger>
          <Trigger value="arhiva" icon={<Trophy className="size-3.5" />}>
            Arhivă
          </Trigger>
          <Trigger value="mesaje" icon={<MessageSquare className="size-3.5" />}>
            Mesaje
          </Trigger>
          <Trigger value="istoric" icon={<Activity className="size-3.5" />}>
            Istoric
          </Trigger>
        </TabsList>

        <TabsContent value="profil" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 lg:col-span-2">
              <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
                Detalii
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <Detail
                  label="Data nașterii"
                  value={new Date(child.dob).toLocaleDateString("ro-RO", {
                    timeZone: "Europe/Bucharest",
                  })}
                />
                <Detail
                  label="Vârstă"
                  value={age != null ? `${age} ani` : "—"}
                />
                <Detail
                  label="Gen"
                  value={
                    child.gender === "M"
                      ? "Băiat"
                      : child.gender === "F"
                        ? "Fată"
                        : "—"
                  }
                />
                <Detail label="Școală" value={child.school ?? "—"} />
                <Detail
                  label="Grupa"
                  value={child.age_group_label ?? "Nealocat"}
                />
                <Detail label="Status" value={child.status} />
              </dl>

              {child.medical_notes && (
                <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-4">
                  <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-amber-200/80">
                    Note medicale
                  </span>
                  <p className="mt-1 font-body text-sm leading-relaxed text-white/85">
                    {child.medical_notes}
                  </p>
                </div>
              )}
            </section>

            <MediaGallery
              childId={child.id}
              uploaderId={profile?.id ?? null}
              canUpload={isParent}
              media={media}
              onUploaded={row => setMedia(prev => [row, ...prev])}
            />
          </div>
        </TabsContent>

        <TabsContent value="stiri" className="mt-5">
          {childNews.length === 0 && (
            <Empty hint="Nu există încă știri pentru această grupă." />
          )}
          <div className="grid gap-3">
            {childNews.map(n => (
              <article
                key={n.id}
                className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-heading text-base font-semibold uppercase tracking-[0.04em] text-white sm:text-lg">
                    {n.title}
                  </h3>
                  {n.published_at && (
                    <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                      {formatTimelineDate(n.published_at)}
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line font-body text-sm leading-relaxed text-white/70">
                  {n.body_md}
                </p>
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="program" className="mt-5">
          {upcoming.length === 0 && (
            <Empty hint="Nu sunt evenimente programate." />
          )}
          <div className="grid gap-3">
            {upcoming.map(e => (
              <ScheduleRowCard
                key={e.id}
                row={e}
                rsvpStatus={attendance.get(e.id) ?? null}
                onConfirm={isParent ? confirmAttendance : undefined}
                busy={confirmingId === e.id}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="arhiva" className="mt-5">
          {past.length === 0 && participations.length === 0 && (
            <Empty hint="Nu există încă evenimente trecute." />
          )}
          <div className="grid gap-3">
            {participations.map(p => (
              <article
                key={p.id}
                className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-heading text-base font-semibold uppercase tracking-[0.04em] text-white">
                    {p.event.title}
                    {p.event.opponent && (
                      <span className="ml-2 text-white/55">
                        {" "}
                        vs {p.event.opponent}
                      </span>
                    )}
                  </h3>
                  <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                    {formatTimelineDate(p.event.starts_at)}
                  </span>
                </div>
                {p.result && (
                  <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-brand-cyan">
                    {p.result.our_score}
                    <span className="mx-2 text-white/40">–</span>
                    {p.result.opponent_score}
                  </p>
                )}
                <p className="mt-1 font-body text-sm text-white/65">
                  {p.role} · ⚽ {p.goals} · 🅰 {p.assists}
                </p>
              </article>
            ))}
            {past.map(e => (
              <ScheduleRowCard key={e.id} row={e} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="mesaje" className="mt-5">
          {messages.length === 0 && (
            <Empty hint="Nu există încă mesaje de la antrenor." />
          )}
          <div className="grid gap-3">
            {messages.map(m => (
              <article
                key={m.id}
                className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-2.5 py-0.5 font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan">
                    {m.audience === "group"
                      ? "Grupa"
                      : m.audience === "child"
                        ? "Copil"
                        : "Părinte"}
                  </span>
                  <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                    {new Date(m.created_at).toLocaleString("ro-RO", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "Europe/Bucharest",
                    })}
                  </span>
                </div>
                {m.trainer?.profile?.full_name && (
                  <p className="mt-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/40">
                    De la {m.trainer.profile.full_name}
                  </p>
                )}
                <p className="mt-2 whitespace-pre-line font-body text-sm leading-relaxed text-white/85">
                  {m.body_md}
                </p>
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="istoric" className="mt-5">
          {events.length === 0 && (
            <Empty hint="Istoricul jucătorului va apărea aici după primele activități." />
          )}
          <ol className="relative ml-3 grid gap-4 border-l border-white/12 pl-6">
            {events.map(e => (
              <li key={e.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[31px] top-2 grid size-3 place-items-center rounded-full border border-brand-cyan bg-[oklch(0.10_0.02_250)]"
                >
                  <span className="block size-1 rounded-full bg-brand-cyan" />
                </span>
                <div className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.04em] text-white">
                      {e.title}
                    </h3>
                    <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan/85">
                      {KIND_LABEL[e.kind] ?? e.kind}
                    </span>
                  </div>
                  <span className="mt-0.5 block font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                    {formatTimelineDate(e.occurred_at)}
                  </span>
                  {e.body_md && (
                    <p className="mt-2 whitespace-pre-line font-body text-sm leading-relaxed text-white/70">
                      {e.body_md}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>
    </MemberShell>
  );
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-white/8 bg-[oklch(0.10_0.02_250)] px-3 py-2.5">
    <dt className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
      {label}
    </dt>
    <dd className="mt-0.5 font-body text-sm text-white/85">{value}</dd>
  </div>
);

const Trigger = ({
  value,
  icon,
  children,
}: {
  value: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <TabsTrigger
    value={value}
    className="flex-1 rounded-full px-3 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-white/65 data-[state=active]:bg-brand-cyan/15 data-[state=active]:text-brand-cyan"
  >
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  </TabsTrigger>
);

const Empty = ({ hint }: { hint: string }) => (
  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center font-body text-sm text-white/55">
    {hint}
  </div>
);

type ScheduleRowCardProps = {
  row: ScheduleRow;
  /** Parent-only: their previous RSVP for this event, if any. */
  rsvpStatus?: "present" | "absent" | "late" | "excused" | null;
  /** Parent-only: handler to record an RSVP. Omit for non-parent viewers. */
  onConfirm?: (eventId: string, coming: boolean) => void;
  /** True while a confirm request is in flight for THIS event. */
  busy?: boolean;
};

const ScheduleRowCard = ({
  row,
  rsvpStatus = null,
  onConfirm,
  busy = false,
}: ScheduleRowCardProps) => (
  <article
    data-event-id={row.id}
    className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 transition-shadow"
  >
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h3 className="font-heading text-base font-semibold uppercase tracking-[0.04em] text-white">
        {row.title}
        {row.opponent && (
          <span className="ml-2 text-white/55">vs {row.opponent}</span>
        )}
      </h3>
      <span className="rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-2.5 py-0.5 font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan">
        {row.kind === "match"
          ? "Meci"
          : row.kind === "training"
            ? "Antrenament"
            : row.kind === "tournament"
              ? "Turneu"
              : "Eveniment"}
      </span>
    </div>
    <p className="mt-1 font-heading text-[11px] uppercase tracking-[0.18em] text-white/50">
      {new Date(row.starts_at).toLocaleString("ro-RO", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}
      {row.location && ` · ${row.location}`}
    </p>

    {row.cancelled_at && (
      <div className="mt-3 rounded-xl border border-rose-300/40 bg-rose-300/[0.08] px-3.5 py-2.5">
        <div className="font-heading text-[10.5px] uppercase tracking-[0.2em] text-rose-300">
          Anulat de antrenor
        </div>
        {row.cancelled_reason && (
          <p className="mt-0.5 font-body text-sm text-rose-200/85">
            {row.cancelled_reason}
          </p>
        )}
      </div>
    )}

    {row.notes && (
      <p className="mt-2 font-body text-sm text-white/70">{row.notes}</p>
    )}
    {row.recap_md && (
      <div className="mt-3 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[0.05] p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-[0.2em] text-brand-cyan">
            <Sparkles className="size-3" />
            Recap antrenament
          </span>
          {row.recap_published_at && (
            <span className="font-heading text-[10px] uppercase tracking-[0.16em] text-white/40">
              {new Date(row.recap_published_at).toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          )}
        </div>
        <p className="whitespace-pre-line font-body text-[13.5px] leading-relaxed text-white/85">
          {row.recap_md}
        </p>
      </div>
    )}

    {/* Parent RSVP — only shown when:
     *   - the row was passed an onConfirm handler (i.e. viewer is parent)
     *   - the event is a future training (matches/tournaments need no RSVP)
     *   - within 5 days so the form doesn't clutter long-tail upcoming
     *   - not cancelled. */}
    {onConfirm &&
      !row.cancelled_at &&
      row.kind === "training" &&
      new Date(row.starts_at).getTime() > Date.now() &&
      new Date(row.starts_at).getTime() - Date.now() < 5 * 24 * 3600_000 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
          <span className="font-heading text-[11px] uppercase tracking-[0.18em] text-white/65">
            {rsvpStatus === "present"
              ? "Ai confirmat: vine"
              : rsvpStatus === "absent"
                ? "Ai confirmat: lipsește"
                : "Vine la antrenament?"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onConfirm(row.id, true)}
              disabled={busy}
              aria-pressed={rsvpStatus === "present"}
              className={
                rsvpStatus === "present"
                  ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-300/45 bg-emerald-300/15 px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-emerald-300 disabled:opacity-60"
                  : "inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-emerald-300/40 hover:text-emerald-300 disabled:opacity-60"
              }
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Da
            </button>
            <button
              type="button"
              onClick={() => onConfirm(row.id, false)}
              disabled={busy}
              aria-pressed={rsvpStatus === "absent"}
              className={
                rsvpStatus === "absent"
                  ? "inline-flex items-center gap-1.5 rounded-full border border-rose-300/45 bg-rose-300/15 px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-rose-300 disabled:opacity-60"
                  : "inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-rose-300/40 hover:text-rose-300 disabled:opacity-60"
              }
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              Nu
            </button>
          </div>
        </div>
      )}
  </article>
);

function MediaGallery({
  childId,
  uploaderId,
  canUpload,
  media,
  onUploaded,
}: {
  childId: string;
  uploaderId: string | null;
  canUpload: boolean;
  media: MediaRow[];
  onUploaded: (row: MediaRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploaderId) return;
    setBusy(true);
    setErr(null);
    const isImage = file.type.startsWith("image/");
    const path = `${uploaderId}/${childId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("fotbal-media-private")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setErr(upErr.message);
      setBusy(false);
      return;
    }
    const { data: ins, error: insErr } = await supabase
      .from("media")
      .insert({
        uploader_id: uploaderId,
        child_id: childId,
        kind: isImage ? "image" : "video",
        storage_path: path,
        mime: file.type,
        bytes: file.size,
      })
      .select("id, storage_path, kind, caption, created_at")
      .single();
    if (insErr || !ins) {
      setErr(insErr?.message ?? "Eroare la salvare.");
      setBusy(false);
      return;
    }
    onUploaded(ins as MediaRow);
    setBusy(false);
  };

  return (
    <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
          Galerie
        </h2>
        {canUpload && (
          <label className="touch-target inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1.5 font-heading text-[10px] font-medium uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/20">
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
            Adaugă
            <input
              type="file"
              accept="image/*,video/*"
              onChange={onPick}
              disabled={busy}
              className="sr-only"
            />
          </label>
        )}
      </div>
      {err && (
        <p className="mt-2 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
          {err}
        </p>
      )}
      {media.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 font-body text-sm text-white/45">
          Nu există încă media. Adaugă o poză sau un clip de la antrenament.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {media.map(m => (
            <li
              key={m.id}
              className="aspect-square overflow-hidden rounded-xl border border-white/8 bg-[oklch(0.10_0.02_250)]"
            >
              <MediaThumb path={m.storage_path} kind={m.kind} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MediaThumb({ path, kind }: { path: string; kind: "image" | "video" }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("fotbal-media-private")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (cancelled) return;
        setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) {
    return <div className="size-full animate-pulse bg-white/[0.04]" />;
  }
  if (kind === "image") {
    return (
      <img src={url} alt="" loading="lazy" className="size-full object-cover" />
    );
  }
  return (
    <video
      src={url}
      muted
      controls
      playsInline
      className="size-full object-cover"
    />
  );
}
