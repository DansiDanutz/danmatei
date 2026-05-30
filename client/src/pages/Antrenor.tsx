/**
 * /antrenor — Trainer dashboard. Single page with 4 tabs:
 *   - Grupa     : list of children assigned to this trainer
 *   - Program   : list + create training / match events
 *   - Mesaje    : send message to group / child + history
 *   - Profil    : edit position, bio, certifications, age range, avatar
 *
 * RLS limits visible rows to this trainer's group. Profile/age-range edits
 * stay in the trainer's own row; reassignment when age range changes is
 * deferred to the owner via /admin (matches the plan: never auto-reassign).
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  CalendarDays,
  ClipboardCheck,
  Inbox,
  Loader2,
  MessageSquare,
  Sparkles,
  Swords,
  Send,
  UserCog,
  Users,
  UsersRound,
  Megaphone,
  CheckCircle2,
} from "lucide-react";
import TrainerAIPanel from "@/components/TrainerAIPanel";
import AtribuiriTab from "@/components/trainer/AtribuiriTab";
import InboxAITab from "@/components/trainer/InboxAITab";
import MatchesTab from "@/components/trainer/MatchesTab";
import AttendanceTab from "@/components/trainer/AttendanceTab";
import TrainingRecapDialog from "@/components/trainer/TrainingRecapDialog";
import ScheduleCalendar from "@/components/trainer/ScheduleCalendar";
import WeeklyScheduleEditor from "@/components/trainer/WeeklyScheduleEditor";
import { TRAINING_BASES, OTHER_LOCATION } from "@/lib/locations";
import { Link } from "wouter";
import { toast } from "sonner";
import MemberShell from "@/components/MemberShell";
import CoachingTips from "@/components/trainer/CoachingTips";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { currentAge } from "@/lib/age";
import { BrandedField } from "@/components/ui/branded-field";

const LOCAL_INPUT_CLS =
  "touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-3 font-body text-base text-white placeholder:text-white/25 focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/20";

type Trainer = {
  id: string;
  position: string | null;
  bio: string | null;
  age_min: number;
  age_max: number;
  certifications: string[] | null;
  active: boolean;
  hero_photo_path: string | null;
  whatsapp_number: string | null;
  elevenlabs_agent_id: string | null;
};

/**
 * Map a trainer's age range to the slug used by the AI-call lead routing
 * in `api/lead/create.ts`. Mirrors that switch:
 *   age 5-9   → t-sopi
 *   age 10-13 → t-kelemen
 *   age 14-15 → t-dan (also CC on every lead)
 */
function derivedTrainerSlug(t: Trainer | null): string | null {
  if (!t) return null;
  const mid = (t.age_min + t.age_max) / 2;
  if (mid <= 9) return "t-sopi";
  if (mid <= 13) return "t-kelemen";
  return "t-dan";
}

type Child = {
  id: string;
  full_name: string;
  dob: string;
  age_group_label: string | null;
  status: "active" | "paused" | "left";
  photo_path: string | null;
  parent: { full_name: string; phone: string | null } | null;
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
  call_time: string | null;
  fee_ron: number | null;
  group_notified_at: string | null;
  recap_md: string | null;
  recap_published_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
};

type MessageRow = {
  id: string;
  audience: "group" | "child" | "parent";
  child_id: string | null;
  body_md: string;
  created_at: string;
  sender_role: "trainer" | "parent";
};

export default function Antrenor() {
  const { profile } = useAuth();
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recapEvent, setRecapEvent] = useState<ScheduleRow | null>(null);
  const [tab, setTab] = useState("grupa");
  const [messagePrefill, setMessagePrefill] = useState<{
    audience: "group" | "child" | "parent";
    childId?: string;
    key: number;
  } | null>(null);

  const refresh = useMemo(
    () => async () => {
      if (!profile) return;
      setError(null);
      const t = await supabase
        .from("trainers")
        .select(
          "id, position, bio, age_min, age_max, certifications, active, hero_photo_path, whatsapp_number, elevenlabs_agent_id"
        )
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (t.error) {
        setError(t.error.message);
        setLoading(false);
        return;
      }
      if (!t.data) {
        setError(
          "Nu există încă un profil de antrenor. Cere-i lui Dan să-ți creeze rolul din /admin."
        );
        setLoading(false);
        return;
      }
      const trainerRow = t.data as Trainer;
      setTrainer(trainerRow);

      const [c, s, m] = await Promise.all([
        supabase
          .from("children")
          .select(
            "id, full_name, dob, age_group_label, status, photo_path, parent:profiles!children_parent_id_fkey(full_name, phone)"
          )
          .eq("trainer_id", trainerRow.id)
          .order("full_name", { ascending: true }),
        supabase
          .from("schedule_events")
          .select(
            "id, kind, title, starts_at, ends_at, location, opponent, notes, call_time, fee_ron, group_notified_at, recap_md, recap_published_at, cancelled_at, cancelled_reason"
          )
          .eq("trainer_id", trainerRow.id)
          .order("starts_at", { ascending: false })
          .limit(40),
        supabase
          .from("messages")
          .select("id, audience, child_id, body_md, created_at, sender_role")
          .eq("trainer_id", trainerRow.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      setChildren((c.data ?? []) as unknown as Child[]);
      setSchedule((s.data ?? []) as ScheduleRow[]);
      setMessages((m.data ?? []) as MessageRow[]);
      setLoading(false);
    },
    [profile]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const upcoming = useMemo(
    () =>
      schedule
        .filter(s => new Date(s.starts_at) >= new Date())
        .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    [schedule]
  );

  if (loading) {
    return (
      <MemberShell>
        <div className="grid place-items-center py-24">
          <Loader2 className="size-5 animate-spin text-brand-cyan" />
        </div>
      </MemberShell>
    );
  }

  if (error || !trainer) {
    return (
      <MemberShell>
        <div className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-8 text-center">
          <h1 className="font-heading text-2xl font-bold uppercase">
            Profil antrenor lipsă
          </h1>
          <p className="mt-2 font-body text-sm text-white/65">{error}</p>
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

  return (
    <MemberShell>
      {/* Header */}
      <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-heading text-[10px] uppercase tracking-[0.22em] text-brand-cyan/80">
              Panou antrenor
            </span>
            <h1 className="font-heading text-3xl font-bold uppercase leading-[1.05] tracking-[0.02em] text-white sm:text-4xl">
              Bună, {profile?.full_name?.split(" ")[0] ?? "antrenor"}
            </h1>
            <p className="mt-1 font-body text-sm text-white/55">
              {trainer.position ?? "Antrenor"} · U{trainer.age_min}–U
              {trainer.age_max}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Stat label="Copii" value={children.length} />
            <Stat label="Săptămâna" value={upcoming.slice(0, 5).length} />
            <Stat label="Mesaje" value={messages.length} />
          </div>
        </div>
      </section>

      <div className="mt-6">
        <CoachingTips recipientId={profile?.id ?? ""} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="relative flex w-full justify-start gap-1 overflow-x-auto rounded-full border border-white/8 bg-[oklch(0.10_0.02_250)] p-1 scrollbar-hide snap-x">
          <Trigger value="grupa" icon={<Users className="size-3.5" />}>
            Grupa
          </Trigger>
          <Trigger value="atribuiri" icon={<UsersRound className="size-3.5" />}>
            Atribuiri
          </Trigger>
          <Trigger value="program" icon={<CalendarDays className="size-3.5" />}>
            Program
          </Trigger>
          <Trigger value="meciuri" icon={<Swords className="size-3.5" />}>
            Meciuri
          </Trigger>
          <Trigger
            value="prezenta"
            icon={<ClipboardCheck className="size-3.5" />}
          >
            Prezență
          </Trigger>
          <Trigger value="mesaje" icon={<MessageSquare className="size-3.5" />}>
            Mesaje
          </Trigger>
          <Trigger value="profil" icon={<UserCog className="size-3.5" />}>
            Profil
          </Trigger>
          <Trigger value="inbox-ai" icon={<Inbox className="size-3.5" />}>
            Inbox AI
          </Trigger>
          <Trigger value="ai" icon={<Bot className="size-3.5" />}>
            AI · WhatsApp
          </Trigger>
        </TabsList>

        {/* GRUPA */}
        <TabsContent value="grupa" className="mt-5">
          <LazyTab active={tab === "grupa"}>
            {children.length === 0 && (
              <Empty hint="Nu ai încă jucători repartizați la grupa ta." />
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {children.map(c => (
                <Link
                  key={c.id}
                  href={`/copil/${c.id}`}
                  className="group relative rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-4 transition-all hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:bg-[oklch(0.15_0.03_250)]/85"
                >
                  <div className="flex items-center gap-3">
                    <RosterAvatar
                      photoPath={c.photo_path}
                      fullName={c.full_name}
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-heading text-sm font-semibold uppercase tracking-[0.04em] text-white">
                        {c.full_name}
                      </h3>
                      <p className="font-body text-xs text-white/55">
                        {currentAge(c.dob)} ani ·{" "}
                        {c.age_group_label ?? "Nealocat"}
                      </p>
                    </div>
                  </div>
                  {c.parent && (
                    <p className="mt-2 font-body text-xs text-white/50">
                      Părinte: {c.parent.full_name}
                      {c.parent.phone && ` · ${c.parent.phone}`}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </LazyTab>
        </TabsContent>

        {/* ATRIBUIRI */}
        <TabsContent value="atribuiri" className="mt-5">
          <LazyTab active={tab === "atribuiri"}>
            <AtribuiriTab trainerId={trainer!.id} />
          </LazyTab>
        </TabsContent>

        {/* PROGRAM */}
        <TabsContent value="program" className="mt-5">
          <LazyTab active={tab === "program"}>
            <div className="space-y-5">
              <WeeklyScheduleEditor
                trainerId={trainer.id}
                onChanged={() => refresh()}
              />
              <ScheduleCalendar
                events={schedule.map(e => ({
                  id: e.id,
                  kind: e.kind,
                  title: e.title,
                  starts_at: e.starts_at,
                  cancelled_at: e.cancelled_at,
                }))}
              />
              <div className="grid gap-5 lg:grid-cols-3">
                <ScheduleForm
                  trainerId={trainer.id}
                  onCreated={() => refresh()}
                />

                <div className="lg:col-span-2">
                  {schedule.length === 0 && (
                    <Empty hint="Niciun eveniment salvat." />
                  )}
                  <div className="grid gap-3">
                    {schedule.map(e => (
                      <article
                        key={e.id}
                        className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <h3 className="font-heading text-base font-semibold uppercase tracking-[0.04em] text-white">
                            {e.title}
                            {e.opponent && (
                              <span className="ml-2 text-white/55">
                                vs {e.opponent}
                              </span>
                            )}
                          </h3>
                          <span className="rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-2.5 py-0.5 font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan">
                            {e.kind === "match"
                              ? "Meci"
                              : e.kind === "training"
                                ? "Antrenament"
                                : e.kind === "tournament"
                                  ? "Turneu"
                                  : e.kind}
                          </span>
                        </div>
                        <p className="mt-1 font-heading text-[11px] uppercase tracking-[0.18em] text-white/50">
                          {new Date(e.starts_at).toLocaleString("ro-RO", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {e.location && ` · ${e.location}`}
                        </p>
                        {(e.call_time ||
                          (e.fee_ron != null && e.fee_ron > 0)) && (
                          <p className="mt-1 font-heading text-[10.5px] uppercase tracking-[0.16em] text-brand-cyan/70">
                            {e.call_time &&
                              `Prezență la ${new Date(
                                e.call_time
                              ).toLocaleTimeString("ro-RO", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Europe/Bucharest",
                              })}`}
                            {e.call_time &&
                              e.fee_ron != null &&
                              e.fee_ron > 0 &&
                              " · "}
                            {e.fee_ron != null &&
                              e.fee_ron > 0 &&
                              `Taxă ${e.fee_ron} RON`}
                          </p>
                        )}
                        {e.notes && (
                          <p className="mt-2 font-body text-sm text-white/70">
                            {e.notes}
                          </p>
                        )}

                        {/* Cancellation banner — visible to trainer when set */}
                        {e.cancelled_at && (
                          <div className="mt-3 rounded-xl border border-rose-300/35 bg-rose-300/[0.08] px-3 py-2">
                            <div className="font-heading text-[10.5px] uppercase tracking-[0.18em] text-rose-300">
                              Anulat
                            </div>
                            {e.cancelled_reason && (
                              <p className="mt-0.5 font-body text-sm text-rose-200/85">
                                {e.cancelled_reason}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Cancel / Reactivate — only on future events */}
                        {new Date(e.starts_at) > new Date() && (
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            {!e.cancelled_at && (
                              <NotifyGroupButton
                                eventId={e.id}
                                notified={!!e.group_notified_at}
                                onChanged={() => refresh()}
                              />
                            )}
                            <CancelEventButton
                              eventId={e.id}
                              cancelled={!!e.cancelled_at}
                              onChanged={() => refresh()}
                            />
                          </div>
                        )}

                        {/* Recap controls — only for past training events.
                         *  Match recaps live in match_results; tournaments &
                         *  others don't use the recap surface. */}
                        {e.kind === "training" &&
                          new Date(e.starts_at) <= new Date() && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
                              {e.recap_published_at ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/30 bg-brand-cyan/[0.08] px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.16em] text-brand-cyan">
                                  <Sparkles className="size-3" />
                                  Recap trimis părinților
                                </span>
                              ) : (
                                <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                                  Niciun recap încă
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setRecapEvent(e)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1.5 font-heading text-[10.5px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/20"
                              >
                                <Sparkles className="size-3.5" />
                                {e.recap_published_at
                                  ? "Editează recap"
                                  : "Recap cu AI"}
                              </button>
                            </div>
                          )}
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </LazyTab>
        </TabsContent>

        {/* MECIURI */}
        <TabsContent value="meciuri" className="mt-5">
          <LazyTab active={tab === "meciuri"}>
            <MatchesTab
              trainerId={trainer.id}
              children={children.map(c => ({
                id: c.id,
                full_name: c.full_name,
              }))}
            />
          </LazyTab>
        </TabsContent>

        {/* PREZENTA */}
        <TabsContent value="prezenta" className="mt-5">
          <LazyTab active={tab === "prezenta"}>
            <AttendanceTab
              trainerId={trainer.id}
              children={children.map(c => ({
                id: c.id,
                full_name: c.full_name,
              }))}
            />
          </LazyTab>
        </TabsContent>

        {/* MESAJE */}
        <TabsContent value="mesaje" className="mt-5">
          <LazyTab active={tab === "mesaje"}>
            <div className="grid gap-5 lg:grid-cols-3">
              <MessageForm
                key={messagePrefill?.key ?? "default"}
                trainerId={trainer.id}
                children_={children}
                onSent={() => refresh()}
                prefill={messagePrefill}
              />
              <div className="lg:col-span-2">
                {messages.length === 0 && (
                  <Empty hint="Nu există încă mesaje." />
                )}
                <div className="grid gap-3">
                  {messages.map(m => {
                    const isParentSender = m.sender_role === "parent";
                    const childName = m.child_id
                      ? (children.find(c => c.id === m.child_id)?.full_name ??
                        null)
                      : null;
                    return (
                      <article
                        key={m.id}
                        className={
                          isParentSender
                            ? "rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[0.06] p-5"
                            : "rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5"
                        }
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span
                            className={
                              isParentSender
                                ? "rounded-full border border-brand-cyan/45 bg-brand-cyan/15 px-2.5 py-0.5 font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan"
                                : "rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 font-heading text-[10px] uppercase tracking-[0.18em] text-white/70"
                            }
                          >
                            {isParentSender
                              ? `Părinte${childName ? `: ${childName}` : ""}`
                              : "Tu"}
                          </span>
                          <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                            {new Date(m.created_at).toLocaleString("ro-RO", {
                              dateStyle: "short",
                              timeStyle: "short",
                              timeZone: "Europe/Bucharest",
                            })}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-line font-body text-sm leading-relaxed text-white/85">
                          {m.body_md}
                        </p>
                        {isParentSender && m.child_id && (
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setMessagePrefill({
                                  audience: "child",
                                  childId: m.child_id ?? undefined,
                                  key: Date.now(),
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan transition-colors hover:bg-brand-cyan/20"
                            >
                              <Send className="size-3" />
                              Răspunde
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </LazyTab>
        </TabsContent>

        {/* PROFIL */}
        <TabsContent value="profil" className="mt-5">
          <LazyTab active={tab === "profil"}>
            <TrainerProfileForm
              trainer={trainer}
              onSaved={t => setTrainer(t)}
            />
          </LazyTab>
        </TabsContent>

        {/* INBOX AI — leads with AI call transcripts */}
        <TabsContent value="inbox-ai" className="mt-5">
          <LazyTab active={tab === "inbox-ai"}>
            <InboxAITab trainerSlug={derivedTrainerSlug(trainer)} />
          </LazyTab>
        </TabsContent>

        {/* AI · WHATSAPP */}
        <TabsContent value="ai" className="mt-5">
          <LazyTab active={tab === "ai"}>
            <TrainerAIPanel
              trainerId={trainer.id}
              initialWhatsapp={trainer.whatsapp_number}
              initialAgentId={trainer.elevenlabs_agent_id}
              onSaved={next =>
                setTrainer(prev => (prev ? { ...prev, ...next } : prev))
              }
            />
          </LazyTab>
        </TabsContent>
      </Tabs>

      {recapEvent && (
        <TrainingRecapDialog
          open={!!recapEvent}
          onOpenChange={open => {
            if (!open) setRecapEvent(null);
          }}
          event={recapEvent}
          onPublished={() => {
            setRecapEvent(null);
            void refresh();
          }}
        />
      )}
    </MemberShell>
  );
}

function LazyTab({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    if (active && !hasMounted) setHasMounted(true);
  }, [active, hasMounted]);
  if (!hasMounted) return null;
  return <>{children}</>;
}

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-center">
    <div className="font-heading text-lg font-bold tabular-nums text-brand-cyan">
      {value}
    </div>
    <div className="font-heading text-[9px] uppercase tracking-[0.18em] text-white/45">
      {label}
    </div>
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
    className="flex-none snap-center rounded-full px-3 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-white/65 data-[state=active]:bg-brand-cyan/15 data-[state=active]:text-brand-cyan md:flex-1"
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

// ─── Roster avatar — photo when present, initials otherwise ─────────────────

function RosterAvatar({
  photoPath,
  fullName,
}: {
  photoPath: string | null;
  fullName: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!photoPath) {
      setUrl(null);
      return;
    }
    void supabase.storage
      .from("fotbal-media-private")
      .createSignedUrl(photoPath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  if (url) {
    return (
      <img
        src={url}
        alt={fullName}
        className="size-10 shrink-0 rounded-full border border-brand-cyan/30 object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-full border border-brand-cyan/30 bg-gradient-to-br from-[oklch(0.55_0.13_230)] via-[oklch(0.32_0.10_230)] to-[oklch(0.18_0.06_240)] font-heading text-sm font-bold text-white">
      {fullName
        .split(" ")
        .map(p => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </div>
  );
}

// ─── Schedule form ────────────────────────────────────────────────────────────

const scheduleSchema = z.object({
  kind: z.enum(["training", "match", "tournament", "other"]),
  title: z.string().min(2, "Titlu prea scurt").max(120),
  startsAt: z.string().min(1, "Dată/oră"),
  opponent: z.string().max(120).optional().or(z.literal("")),
  callTime: z.string().optional().or(z.literal("")),
  feeRon: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});
type ScheduleValues = z.infer<typeof scheduleSchema>;

// ─── Cancel / Reactivate event ──────────────────────────────────────────────

function CancelEventButton({
  eventId,
  cancelled,
  onChanged,
}: {
  eventId: string;
  cancelled: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    const reason = window.prompt(
      "Motivul anulării (opțional — apare în notificarea părinților):",
      ""
    );
    if (reason === null) return; // user cancelled the prompt
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sesiune expirată — autentifică-te din nou.");
        return;
      }
      const r = await fetch("/api/schedule/cancel", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId, reason }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        notified?: number;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        toast.error("Nu am putut anula", {
          description: j.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      const sent = j.notified ?? 0;
      toast.success(
        sent > 0
          ? `Anulat — notificat ${sent} ${sent === 1 ? "părinte" : "părinți"}`
          : "Anulat"
      );
      onChanged();
    } catch (err) {
      toast.error("Eroare de rețea", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const reactivate = async () => {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sesiune expirată — autentifică-te din nou.");
        return;
      }
      const r = await fetch("/api/schedule/cancel", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId, uncancel: true }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        toast.error("Nu am putut reactiva", {
          description: j.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      toast.success("Reactivat — părinții NU au fost re-notificați.");
      onChanged();
    } catch (err) {
      toast.error("Eroare de rețea", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  if (cancelled) {
    return (
      <button
        type="button"
        onClick={reactivate}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-300/[0.08] px-3 py-1.5 font-heading text-[10.5px] uppercase tracking-[0.16em] text-emerald-300 transition-colors hover:bg-emerald-300/15 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Reactivează
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/35 bg-rose-300/[0.05] px-3 py-1.5 font-heading text-[10.5px] uppercase tracking-[0.16em] text-rose-200/85 transition-colors hover:bg-rose-300/15 hover:text-rose-200 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
      Anulează
    </button>
  );
}

// ─── Notify group of an event (trainer's approval) ──────────────────────────

function NotifyGroupButton({
  eventId,
  notified,
  onChanged,
}: {
  eventId: string;
  notified: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (notified) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/[0.08] px-3 py-1.5 font-heading text-[10.5px] uppercase tracking-[0.16em] text-emerald-300">
        <CheckCircle2 className="size-3.5" />
        Notificat
      </span>
    );
  }

  const send = async () => {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sesiune expirată — autentifică-te din nou.");
        return;
      }
      const r = await fetch("/api/schedule/notify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        notified?: number;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        toast.error("Nu am putut notifica", {
          description: j.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      const sent = j.notified ?? 0;
      toast.success(
        sent > 0
          ? `Notificat ${sent} ${sent === 1 ? "părinte" : "părinți"}`
          : "Trimis (niciun părinte cu copil activ în grupă)"
      );
      onChanged();
    } catch (err) {
      toast.error("Eroare de rețea", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={send}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1.5 font-heading text-[10.5px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/20 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Megaphone className="size-3.5" />
      )}
      Notifică grupa
    </button>
  );
}

function ScheduleForm({
  trainerId,
  onCreated,
}: {
  trainerId: string;
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [locChoice, setLocChoice] = useState<string>(TRAINING_BASES[0]);
  const [customLoc, setCustomLoc] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { kind: "training" },
  });
  const kind = watch("kind");
  const isTraining = kind === "training";

  const onSubmit = handleSubmit(async v => {
    setServerError(null);
    const location =
      locChoice === OTHER_LOCATION ? customLoc.trim() || null : locChoice;
    const fee = v.feeRon ? Number(v.feeRon) : null;
    const { error } = await supabase.from("schedule_events").insert({
      trainer_id: trainerId,
      kind: v.kind,
      title: v.title,
      starts_at: new Date(v.startsAt).toISOString(),
      location,
      opponent: v.kind === "match" ? v.opponent || null : null,
      call_time:
        v.kind !== "training" && v.callTime
          ? new Date(v.callTime).toISOString()
          : null,
      fee_ron:
        v.kind !== "training" && fee != null && !Number.isNaN(fee) ? fee : null,
      notes: v.notes || null,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    reset({ kind: v.kind });
    setCustomLoc("");
    onCreated();
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5"
    >
      <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
        Eveniment nou
      </h2>
      <div className="flex gap-2">
        {[
          { k: "training" as const, label: "Antrenament" },
          { k: "match" as const, label: "Meci" },
          { k: "tournament" as const, label: "Turneu" },
          { k: "other" as const, label: "Altul" },
        ].map(({ k, label }) => (
          <label
            key={k}
            className={`flex-1 cursor-pointer rounded-xl border px-2 py-2 text-center font-heading text-[11px] uppercase tracking-[0.14em] transition-colors ${
              kind === k
                ? "border-brand-cyan/60 bg-brand-cyan/10 text-brand-cyan"
                : "border-white/10 bg-white/[0.03] text-white/65 hover:text-white"
            }`}
          >
            <input
              type="radio"
              value={k}
              {...register("kind")}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
      <BrandedField
        htmlFor="schedule-title"
        label="Titlu"
        error={errors.title?.message}
      >
        <input
          id="schedule-title"
          type="text"
          {...register("title")}
          placeholder="ex. Antrenament tactic"
          className={LOCAL_INPUT_CLS}
        />
      </BrandedField>
      <BrandedField
        htmlFor="schedule-starts"
        label="Dată / oră"
        error={errors.startsAt?.message}
      >
        <input
          id="schedule-starts"
          type="datetime-local"
          {...register("startsAt")}
          className={LOCAL_INPUT_CLS}
        />
      </BrandedField>
      <div>
        <label
          htmlFor="schedule-location"
          className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
        >
          Locație
        </label>
        <select
          id="schedule-location"
          value={locChoice}
          onChange={e => setLocChoice(e.target.value)}
          className={LOCAL_INPUT_CLS}
        >
          {TRAINING_BASES.map(b => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
          <option value={OTHER_LOCATION}>{OTHER_LOCATION}</option>
        </select>
        {locChoice === OTHER_LOCATION && (
          <input
            type="text"
            value={customLoc}
            onChange={e => setCustomLoc(e.target.value)}
            placeholder="Scrie locația…"
            className={`${LOCAL_INPUT_CLS} mt-2`}
          />
        )}
      </div>
      {kind === "match" && (
        <BrandedField
          htmlFor="schedule-opponent"
          label="Adversar"
          error={errors.opponent?.message}
        >
          <input
            id="schedule-opponent"
            type="text"
            {...register("opponent")}
            placeholder="ACS Sănătatea"
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
      )}
      {!isTraining && (
        <div className="grid grid-cols-2 gap-3">
          <BrandedField
            htmlFor="schedule-call"
            label="Prezență la (opțional)"
            error={errors.callTime?.message}
          >
            <input
              id="schedule-call"
              type="datetime-local"
              {...register("callTime")}
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
          <BrandedField
            htmlFor="schedule-fee"
            label="Taxă RON (opțional)"
            error={errors.feeRon?.message}
          >
            <input
              id="schedule-fee"
              type="number"
              step="0.01"
              min="0"
              {...register("feeRon")}
              placeholder="0"
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
        </div>
      )}
      <div>
        <label
          htmlFor="schedule-notes"
          className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
        >
          Note (opțional)
        </label>
        <textarea
          id="schedule-notes"
          rows={2}
          {...register("notes")}
          className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 outline-none focus:border-brand-cyan/60"
        />
      </div>
      {serverError && (
        <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
          {serverError}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="touch-target inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          "Salvează"
        )}
      </button>
    </form>
  );
}

// ─── Message form ─────────────────────────────────────────────────────────────

const messageSchema = z.object({
  audience: z.enum(["group", "child", "parent"]),
  childId: z.string().optional(),
  body: z.string().min(2, "Mesaj prea scurt").max(2000),
});
type MessageValues = z.infer<typeof messageSchema>;

function MessageForm({
  trainerId,
  children_,
  onSent,
  prefill,
}: {
  trainerId: string;
  children_: Child[];
  onSent: () => void;
  prefill?: { audience: "group" | "child" | "parent"; childId?: string } | null;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MessageValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { audience: "group", body: "" },
  });
  const audience = watch("audience");

  useEffect(() => {
    if (!prefill) return;
    reset({
      audience: prefill.audience,
      childId: prefill.childId,
      body: "",
    });
  }, [prefill, reset]);

  const onSubmit = handleSubmit(async v => {
    setServerError(null);
    // Route through /api/messages/send so the in-app insert (via DB trigger)
    // and the Web Push fan-out happen together. Falls back to a clear
    // server error message on failure.
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setServerError("Sesiune expirată — autentifică-te din nou.");
      return;
    }
    const r = await fetch("/api/messages/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        trainerId,
        audience: v.audience,
        childId: v.audience === "child" ? v.childId : null,
        body: v.body,
      }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!r.ok || !j.ok) {
      setServerError(j.error ?? `HTTP ${r.status}`);
      return;
    }
    reset({ audience: v.audience, body: "", childId: v.childId });
    onSent();
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5"
    >
      <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
        Mesaj nou
      </h2>
      <div className="flex gap-2">
        {(
          [
            { key: "group", label: "Grupa" },
            { key: "child", label: "Un copil" },
            { key: "parent", label: "Părinte" },
          ] as const
        ).map(a => (
          <label
            key={a.key}
            className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-center font-heading text-[11px] uppercase tracking-[0.16em] transition-colors ${
              audience === a.key
                ? "border-brand-cyan/60 bg-brand-cyan/10 text-brand-cyan"
                : "border-white/10 bg-white/[0.03] text-white/65 hover:text-white"
            }`}
          >
            <input
              type="radio"
              value={a.key}
              {...register("audience")}
              className="sr-only"
            />
            {a.label}
          </label>
        ))}
      </div>

      {(audience === "child" || audience === "parent") && (
        <div>
          <label
            htmlFor="msg-child"
            className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
          >
            {audience === "child" ? "Copil" : "Copil (părintele lui)"}
          </label>
          <select
            id="msg-child"
            {...register("childId")}
            className="touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white focus:border-brand-cyan/60"
          >
            <option value="">Alege copilul…</option>
            {children_.map(c => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label
          htmlFor="msg-body"
          className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
        >
          Mesaj
        </label>
        <textarea
          id="msg-body"
          rows={5}
          {...register("body")}
          placeholder="Salut părinți, mâine antrenamentul…"
          className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
        />
        {errors.body && (
          <p className="mt-1 font-body text-xs text-rose-300/85">
            {errors.body.message}
          </p>
        )}
      </div>

      {serverError && (
        <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
          {serverError}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="touch-target inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <>
            <Send className="size-3.5" />
            Trimite
          </>
        )}
      </button>
    </form>
  );
}

// ─── Trainer profile form ─────────────────────────────────────────────────────

const profileSchema = z.object({
  position: z.string().max(120).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  ageMin: z.number().min(4).max(25),
  ageMax: z.number().min(4).max(25),
  certifications: z.string().max(500).optional().or(z.literal("")),
});
type ProfileValues = z.infer<typeof profileSchema>;

function TrainerProfileForm({
  trainer,
  onSaved,
}: {
  trainer: Trainer;
  onSaved: (t: Trainer) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      position: trainer.position ?? "",
      bio: trainer.bio ?? "",
      ageMin: trainer.age_min,
      ageMax: trainer.age_max,
      certifications: (trainer.certifications ?? []).join(", "),
    },
  });

  const onSubmit = handleSubmit(async v => {
    setServerError(null);
    setOkMessage(null);
    if (v.ageMax < v.ageMin) {
      setServerError(
        "Vârsta maximă trebuie să fie mai mare sau egală cu cea minimă."
      );
      return;
    }
    const certs = v.certifications
      ? v.certifications
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
      : [];
    const { data, error } = await supabase
      .from("trainers")
      .update({
        position: v.position || null,
        bio: v.bio || null,
        age_min: v.ageMin,
        age_max: v.ageMax,
        certifications: certs,
      })
      .eq("id", trainer.id)
      .select(
        "id, position, bio, age_min, age_max, certifications, active, hero_photo_path"
      )
      .single();
    if (error || !data) {
      setServerError(error?.message ?? "Eroare la salvare.");
      return;
    }
    onSaved(data as Trainer);
    setOkMessage("Profil actualizat.");
  });

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7"
    >
      <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
        Profil antrenor
      </h2>
      <BrandedField
        htmlFor="profile-position"
        label="Funcție"
        error={errors.position?.message}
      >
        <input
          id="profile-position"
          type="text"
          {...register("position")}
          placeholder="Antrenor U10–U12"
          className={LOCAL_INPUT_CLS}
        />
      </BrandedField>
      <div>
        <label
          htmlFor="profile-bio"
          className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
        >
          Biografie
        </label>
        <textarea
          id="profile-bio"
          rows={4}
          {...register("bio")}
          className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <BrandedField
          htmlFor="profile-min"
          label="Vârstă min"
          error={errors.ageMin?.message}
        >
          <input
            id="profile-min"
            type="number"
            min={4}
            max={25}
            {...register("ageMin", { valueAsNumber: true })}
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
        <BrandedField
          htmlFor="profile-max"
          label="Vârstă max"
          error={errors.ageMax?.message}
        >
          <input
            id="profile-max"
            type="number"
            min={4}
            max={25}
            {...register("ageMax", { valueAsNumber: true })}
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
      </div>
      <BrandedField
        htmlFor="profile-certs"
        label="Certificări (separă prin virgulă)"
        error={errors.certifications?.message}
      >
        <input
          id="profile-certs"
          type="text"
          {...register("certifications")}
          placeholder="UEFA C, Prim ajutor"
          className={LOCAL_INPUT_CLS}
        />
      </BrandedField>

      {serverError && (
        <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
          {serverError}
        </p>
      )}
      {okMessage && (
        <p className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 font-body text-xs text-emerald-200">
          {okMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="touch-target inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          "Salvează"
        )}
      </button>
    </form>
  );
}
