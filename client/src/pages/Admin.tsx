/**
 * /admin — owner-only dashboard. 3 tabs:
 *
 *   Antrenori — list, add (calls /api/trainers), edit, deactivate
 *   Membri    — directory of parents + children + assigned trainer
 *   Pagina    — edit landing_content slots (hero / owner) used by /cunoaste
 *
 * Trainer create goes through a serverless function because it needs the
 * service role to call `auth.admin.inviteUserByEmail`. Everything else is
 * direct Supabase JS calls limited by RLS.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  Calendar,
  Check,
  Loader2,
  Newspaper,
  Pencil,
  Receipt,
  RefreshCcw,
  Save,
  Send,
  Tag,
  TrendingUp,
  Users,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import MemberShell from "@/components/MemberShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { currentAge } from "@/lib/age";
import GroupsTab from "@/components/admin/GroupsTab";
import NewsManager from "@/components/admin/NewsManager";
import ScheduleOversight from "@/components/admin/ScheduleOversight";
import NotificationManager from "@/components/admin/NotificationManager";
import AtRiskTab from "@/components/admin/AtRiskTab";
import LeadAnalyticsTab from "@/components/admin/LeadAnalyticsTab";
import PaymentsTab from "@/components/admin/PaymentsTab";
import { BrandedField } from "@/components/ui/branded-field";

const LOCAL_INPUT_CLS =
  "touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-3 font-body text-base text-white placeholder:text-white/25 focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/20";

type TrainerRow = {
  id: string;
  profile_id: string;
  position: string | null;
  bio: string | null;
  age_min: number;
  age_max: number;
  certifications: string[] | null;
  whatsapp_number: string | null;
  elevenlabs_agent_id: string | null;
  active: boolean;
  created_at: string;
  profile: { full_name: string; phone: string | null } | null;
  child_count?: number;
};

type ChildRow = {
  id: string;
  full_name: string;
  dob: string;
  school: string | null;
  medical_notes: string | null;
  age_group_label: string | null;
  status: "active" | "paused" | "left" | "closed_unpaid" | "transferred";
  trainer_id: string | null;
  parent: { id: string; full_name: string; phone: string | null } | null;
};

type TrainerOption = {
  id: string;
  full_name: string;
  active: boolean;
};

const STATUS_LABEL: Record<ChildRow["status"], string> = {
  active: "activ",
  paused: "pauzat",
  left: "plecat",
  closed_unpaid: "cont închis (neplată)",
  transferred: "transferat",
};

const childEditSchema = z.object({
  full_name: z.string().min(1, "Numele este obligatoriu").max(120),
  school: z.string().max(160).optional().or(z.literal("")),
  medical_notes: z.string().max(1000).optional().or(z.literal("")),
});
type ChildEditValues = z.infer<typeof childEditSchema>;

type LandingRow = {
  id: string;
  slot: "hero" | "owner" | "trainers" | "players";
  payload: Record<string, unknown>;
};

export default function Admin() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("antrenori");
  return (
    <MemberShell
      navLinks={[
        { href: "/admin", label: "Admin" },
        { href: "/dashboard", label: "Dashboard" },
      ]}
    >
      <header className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7">
        <span className="font-heading text-[10px] uppercase tracking-[0.22em] text-brand-cyan/80">
          Panou proprietar
        </span>
        <h1 className="font-heading text-3xl font-bold uppercase leading-[1.05] tracking-[0.02em] text-white sm:text-4xl">
          {profile?.full_name?.split(" ")[0] ?? "Dan"} Admin
        </h1>
        <p className="mt-1 font-body text-sm text-white/55">
          Gestionezi antrenorii, membrii și conținutul public al site-ului.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="relative flex w-full gap-1 overflow-x-auto rounded-full border border-white/8 bg-[oklch(0.10_0.02_250)] p-1 scrollbar-hide snap-x">
          <Trigger value="antrenori" icon={<UserPlus className="size-3.5" />}>
            Antrenori
          </Trigger>
          <Trigger value="grupe" icon={<UsersRound className="size-3.5" />}>
            Grupe
          </Trigger>
          <Trigger value="membri" icon={<Users className="size-3.5" />}>
            Membri
          </Trigger>
          <Trigger value="risc" icon={<AlertTriangle className="size-3.5" />}>
            Risc
          </Trigger>
          <Trigger value="plati" icon={<Receipt className="size-3.5" />}>
            Plăți
          </Trigger>
          <Trigger value="funnel" icon={<TrendingUp className="size-3.5" />}>
            Funnel
          </Trigger>
          <Trigger value="stiri" icon={<Tag className="size-3.5" />}>
            Știri
          </Trigger>
          <Trigger value="program" icon={<Calendar className="size-3.5" />}>
            Program
          </Trigger>
          <Trigger value="notificari" icon={<Bell className="size-3.5" />}>
            Notificări
          </Trigger>
          <Trigger value="pagina" icon={<Newspaper className="size-3.5" />}>
            Pagina publică
          </Trigger>
        </TabsList>

        <TabsContent value="antrenori" className="mt-5">
          <LazyTab active={tab === "antrenori"}>
            <TrainersTab />
          </LazyTab>
        </TabsContent>
        <TabsContent value="grupe" className="mt-5">
          <LazyTab active={tab === "grupe"}>
            <GroupsTab />
          </LazyTab>
        </TabsContent>
        <TabsContent value="membri" className="mt-5">
          <LazyTab active={tab === "membri"}>
            <MembersTab />
          </LazyTab>
        </TabsContent>
        <TabsContent value="risc" className="mt-5">
          <LazyTab active={tab === "risc"}>
            <AtRiskTab />
          </LazyTab>
        </TabsContent>
        <TabsContent value="plati" className="mt-5">
          <LazyTab active={tab === "plati"}>
            <PaymentsTab />
          </LazyTab>
        </TabsContent>
        <TabsContent value="funnel" className="mt-5">
          <LazyTab active={tab === "funnel"}>
            <LeadAnalyticsTab />
          </LazyTab>
        </TabsContent>
        <TabsContent value="stiri" className="mt-5">
          <LazyTab active={tab === "stiri"}>
            <NewsManager />
          </LazyTab>
        </TabsContent>
        <TabsContent value="program" className="mt-5">
          <LazyTab active={tab === "program"}>
            <ScheduleOversight />
          </LazyTab>
        </TabsContent>
        <TabsContent value="notificari" className="mt-5">
          <LazyTab active={tab === "notificari"}>
            <NotificationManager />
          </LazyTab>
        </TabsContent>

        <TabsContent value="pagina" className="mt-5">
          <LazyTab active={tab === "pagina"}>
            <LandingTab />
          </LazyTab>
        </TabsContent>
      </Tabs>
    </MemberShell>
  );
}

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
    className="flex-1 snap-center rounded-full px-3 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-white/65 data-[state=active]:bg-brand-cyan/15 data-[state=active]:text-brand-cyan"
  >
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  </TabsTrigger>
);

// ─── Trainers tab ─────────────────────────────────────────────────────────────

const newTrainerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(30).optional().or(z.literal("")),
  whatsappNumber: z.string().max(30).optional().or(z.literal("")),
  position: z.string().max(120).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  ageMin: z.number().min(4).max(25),
  ageMax: z.number().min(4).max(25),
  certifications: z.string().max(500).optional().or(z.literal("")),
  elevenlabsAgentId: z.string().max(120).optional().or(z.literal("")),
});
type NewTrainerValues = z.infer<typeof newTrainerSchema>;

// Edit schema mirrors the create schema minus `email` — the login identity
// lives in auth.users and can't be changed from here.
const trainerEditSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().max(30).optional().or(z.literal("")),
  whatsappNumber: z.string().max(30).optional().or(z.literal("")),
  position: z.string().max(120).optional().or(z.literal("")),
  elevenlabsAgentId: z.string().max(120).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  ageMin: z.number().min(4).max(25),
  ageMax: z.number().min(4).max(25),
  certifications: z.string().max(500).optional().or(z.literal("")),
});
type TrainerEditValues = z.infer<typeof trainerEditSchema>;

function trainerToForm(t: TrainerRow): TrainerEditValues {
  return {
    fullName: t.profile?.full_name ?? "",
    phone: t.profile?.phone ?? "",
    whatsappNumber: t.whatsapp_number ?? "",
    position: t.position ?? "",
    elevenlabsAgentId: t.elevenlabs_agent_id ?? "",
    bio: t.bio ?? "",
    ageMin: t.age_min,
    ageMax: t.age_max,
    certifications: (t.certifications ?? []).join(", "),
  };
}

function TrainersTab() {
  const { session } = useAuth();
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewTrainerValues>({
    resolver: zodResolver(newTrainerSchema),
    defaultValues: { ageMin: 8, ageMax: 11 },
  });

  const refresh = useMemo(
    () => async () => {
      const [{ data, error }, counts] = await Promise.all([
        supabase
          .from("trainers")
          .select(
            "id, profile_id, position, bio, age_min, age_max, certifications, whatsapp_number, elevenlabs_agent_id, active, created_at, profile:profiles!trainers_profile_id_fkey(full_name, phone)"
          )
          .order("display_order", { ascending: true }),
        supabase.from("children").select("trainer_id").eq("status", "active"),
      ]);
      if (error) {
        setServerError(error.message);
        setLoading(false);
        return;
      }
      const map = new Map<string, number>();
      (counts.data ?? []).forEach(c => {
        if (c.trainer_id)
          map.set(c.trainer_id, (map.get(c.trainer_id) ?? 0) + 1);
      });
      const rows = (data as unknown as TrainerRow[]).map(t => ({
        ...t,
        child_count: map.get(t.id) ?? 0,
      }));
      setTrainers(rows);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const onSubmit = handleSubmit(async v => {
    setServerError(null);
    setOkMsg(null);
    if (v.ageMax < v.ageMin) {
      setServerError(
        "Vârsta maximă trebuie să fie mai mare sau egală cu cea minimă."
      );
      return;
    }
    const certifications = v.certifications
      ? v.certifications
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    const r = await fetch("/api/trainers", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        email: v.email,
        fullName: v.fullName,
        phone: v.phone || null,
        whatsappNumber: v.whatsappNumber || null,
        elevenlabsAgentId: v.elevenlabsAgentId || null,
        position: v.position || null,
        bio: v.bio || null,
        ageMin: v.ageMin,
        ageMax: v.ageMax,
        certifications,
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      setServerError(`API ${r.status}: ${text || r.statusText}`);
      return;
    }
    setOkMsg(
      "Invitație trimisă pe email. Antrenorul își setează parola și apoi accesează /antrenor."
    );
    reset({ ageMin: 8, ageMax: 11 });
    refresh();
  });

  const toggleActive = async (t: TrainerRow) => {
    const { error } = await supabase
      .from("trainers")
      .update({ active: !t.active })
      .eq("id", t.id);
    if (error) {
      setServerError(error.message);
      return;
    }
    refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Add form */}
      <form
        onSubmit={onSubmit}
        className="grid gap-3 rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 lg:col-span-1"
      >
        <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
          Antrenor nou
        </h2>
        <BrandedField htmlFor="t-email" label="Email" error={errors.email?.message}>
          <input
            id="t-email"
            type="email"
            {...register("email")}
            placeholder="antrenor@email.ro"
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
        <BrandedField htmlFor="t-name" label="Nume complet" error={errors.fullName?.message}>
          <input
            id="t-name"
            type="text"
            {...register("fullName")}
            placeholder="Andrei Popa"
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
        <BrandedField htmlFor="t-phone" label="Telefon (opțional)" error={errors.phone?.message}>
          <input
            id="t-phone"
            type="text"
            {...register("phone")}
            placeholder="+40 7XX XXX XXX"
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
        <BrandedField htmlFor="t-whatsapp" label="WhatsApp (E.164)" error={errors.whatsappNumber?.message}>
          <input
            id="t-whatsapp"
            type="text"
            {...register("whatsappNumber")}
            placeholder="+40744311147"
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
        <BrandedField htmlFor="t-position" label="Funcție" error={errors.position?.message}>
          <input
            id="t-position"
            type="text"
            {...register("position")}
            placeholder="Antrenor U10–U12"
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
        <BrandedField htmlFor="t-agent" label="ElevenLabs Agent ID (opțional)" error={errors.elevenlabsAgentId?.message}>
          <input
            id="t-agent"
            type="text"
            {...register("elevenlabsAgentId")}
            placeholder="agent_xxx (lasă gol pentru asistentul implicit)"
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
        <div>
          <label
            htmlFor="t-bio"
            className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
          >
            Biografie
          </label>
          <textarea
            id="t-bio"
            rows={3}
            {...register("bio")}
            className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <BrandedField htmlFor="t-min" label="Vârstă min" error={errors.ageMin?.message}>
            <input
              id="t-min"
              type="number"
              min={4}
              max={25}
              {...register("ageMin", { valueAsNumber: true })}
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
          <BrandedField htmlFor="t-max" label="Vârstă max" error={errors.ageMax?.message}>
            <input
              id="t-max"
              type="number"
              min={4}
              max={25}
              {...register("ageMax", { valueAsNumber: true })}
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
        </div>
        <BrandedField htmlFor="t-certs" label="Certificări (separă prin virgulă)" error={errors.certifications?.message}>
          <input
            id="t-certs"
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
        {okMsg && (
          <p className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 font-body text-xs text-emerald-200">
            {okMsg}
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
              Trimite invitație
            </>
          )}
        </button>
      </form>

      {/* List */}
      <div className="grid gap-3 lg:col-span-2">
        {loading && (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-5 animate-spin text-brand-cyan" />
          </div>
        )}
        {!loading && trainers.length === 0 && (
          <Empty hint="Nu există încă antrenori." />
        )}
        {!loading &&
          trainers.map(t => (
            <TrainerCard
              key={t.id}
              trainer={t}
              onToggleActive={() => toggleActive(t)}
              onSaved={refresh}
              onError={setServerError}
            />
          ))}
      </div>
    </div>
  );
}

// ─── Trainer card ─────────────────────────────────────────────────────────────

// One trainer row + inline editor. Owner RLS ("profiles owner update any" +
// "trainers owner write") lets us patch both tables straight from the client,
// the same way ChildCard / toggleActive already do.
function TrainerCard({
  trainer: t,
  onToggleActive,
  onSaved,
  onError,
}: {
  trainer: TrainerRow;
  onToggleActive: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TrainerEditValues>({
    resolver: zodResolver(trainerEditSchema),
    defaultValues: trainerToForm(t),
  });

  const startEdit = () => {
    reset(trainerToForm(t));
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    reset(trainerToForm(t));
  };

  const onSubmit = handleSubmit(async v => {
    if (v.ageMax < v.ageMin) {
      onError("Vârsta maximă trebuie să fie mai mare sau egală cu cea minimă.");
      toast.error("Interval de vârstă invalid.");
      return;
    }
    const certifications = v.certifications
      ? v.certifications
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
      : [];

    // 1. Profile (name + phone) — owner can update any profile row.
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        full_name: v.fullName.trim(),
        phone: v.phone?.trim() ? v.phone.trim() : null,
      })
      .eq("id", t.profile_id);
    if (pErr) {
      onError(pErr.message);
      toast.error("Salvarea a eșuat", { description: pErr.message });
      return;
    }

    // 2. Trainer row (everything else).
    const { error: tErr } = await supabase
      .from("trainers")
      .update({
        position: v.position?.trim() ? v.position.trim() : null,
        whatsapp_number: v.whatsappNumber?.trim() ? v.whatsappNumber.trim() : null,
        elevenlabs_agent_id: v.elevenlabsAgentId?.trim()
          ? v.elevenlabsAgentId.trim()
          : null,
        bio: v.bio?.trim() ? v.bio.trim() : null,
        age_min: v.ageMin,
        age_max: v.ageMax,
        certifications,
      })
      .eq("id", t.id);
    if (tErr) {
      onError(tErr.message);
      toast.error("Salvarea a eșuat", { description: tErr.message });
      return;
    }

    toast.success("Datele antrenorului au fost actualizate.");
    setEditing(false);
    onSaved();
  });

  return (
    <article className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold uppercase tracking-[0.04em] text-white">
            {t.profile?.full_name ?? "—"}
          </h3>
          <p className="mt-0.5 font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan/85">
            {t.position ?? `U${t.age_min}–U${t.age_max}`}
            {t.profile?.phone && ` · ${t.profile.phone}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/70">
            {t.child_count ?? 0} copii
          </span>
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 hover:border-brand-cyan/40 hover:text-white"
            >
              <Pencil className="size-3" />
              Editează
            </button>
          )}
          <button
            type="button"
            onClick={onToggleActive}
            className={`rounded-full border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] transition-colors ${
              t.active
                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/20"
                : "border-white/15 bg-white/[0.04] text-white/55 hover:text-white"
            }`}
          >
            {t.active ? "Activ" : "Inactiv"}
          </button>
        </div>
      </div>

      {!editing && t.bio && (
        <p className="mt-2 font-body text-sm leading-relaxed text-white/65">
          {t.bio}
        </p>
      )}
      {!editing && (t.certifications?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(t.certifications ?? []).map(c => (
            <span
              key={c}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-heading text-[10px] uppercase tracking-[0.14em] text-white/70"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {editing && (
        <form
          onSubmit={onSubmit}
          className="mt-4 grid gap-3 border-t border-white/8 pt-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandedField
              htmlFor={`te-name-${t.id}`}
              label="Nume complet"
              error={errors.fullName?.message}
              required
            >
              <input
                id={`te-name-${t.id}`}
                type="text"
                {...register("fullName")}
                className={LOCAL_INPUT_CLS}
              />
            </BrandedField>
            <BrandedField
              htmlFor={`te-phone-${t.id}`}
              label="Telefon"
              error={errors.phone?.message}
            >
              <input
                id={`te-phone-${t.id}`}
                type="text"
                {...register("phone")}
                placeholder="+40 7XX XXX XXX"
                className={LOCAL_INPUT_CLS}
              />
            </BrandedField>
            <BrandedField
              htmlFor={`te-whatsapp-${t.id}`}
              label="WhatsApp (E.164)"
              error={errors.whatsappNumber?.message}
            >
              <input
                id={`te-whatsapp-${t.id}`}
                type="text"
                {...register("whatsappNumber")}
                placeholder="+40744311147"
                className={LOCAL_INPUT_CLS}
              />
            </BrandedField>
            <BrandedField
              htmlFor={`te-position-${t.id}`}
              label="Funcție"
              error={errors.position?.message}
            >
              <input
                id={`te-position-${t.id}`}
                type="text"
                {...register("position")}
                placeholder="Antrenor U10–U12"
                className={LOCAL_INPUT_CLS}
              />
            </BrandedField>
          </div>
          <BrandedField
            htmlFor={`te-agent-${t.id}`}
            label="ElevenLabs Agent ID (opțional)"
            error={errors.elevenlabsAgentId?.message}
          >
            <input
              id={`te-agent-${t.id}`}
              type="text"
              {...register("elevenlabsAgentId")}
              placeholder="agent_xxx (lasă gol pentru asistentul implicit)"
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
          <BrandedField
            htmlFor={`te-bio-${t.id}`}
            label="Biografie"
            error={errors.bio?.message}
          >
            <textarea
              id={`te-bio-${t.id}`}
              rows={3}
              {...register("bio")}
              className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
            />
          </BrandedField>
          <div className="grid grid-cols-2 gap-3">
            <BrandedField
              htmlFor={`te-min-${t.id}`}
              label="Vârstă min"
              error={errors.ageMin?.message}
            >
              <input
                id={`te-min-${t.id}`}
                type="number"
                min={4}
                max={25}
                {...register("ageMin", { valueAsNumber: true })}
                className={LOCAL_INPUT_CLS}
              />
            </BrandedField>
            <BrandedField
              htmlFor={`te-max-${t.id}`}
              label="Vârstă max"
              error={errors.ageMax?.message}
            >
              <input
                id={`te-max-${t.id}`}
                type="number"
                min={4}
                max={25}
                {...register("ageMax", { valueAsNumber: true })}
                className={LOCAL_INPUT_CLS}
              />
            </BrandedField>
          </div>
          <BrandedField
            htmlFor={`te-certs-${t.id}`}
            label="Certificări (separă prin virgulă)"
            error={errors.certifications?.message}
          >
            <input
              id={`te-certs-${t.id}`}
              type="text"
              {...register("certifications")}
              placeholder="UEFA C, Prim ajutor"
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="size-3.5" />
                  Salvează
                </>
              )}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 hover:text-white disabled:opacity-60"
            >
              <X className="size-3" />
              Anulează
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

// ─── Members tab ──────────────────────────────────────────────────────────────

function MembersTab() {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const trainerNames = useMemo(() => {
    const map: Record<string, string> = {};
    trainers.forEach(t => {
      map[t.id] = t.full_name;
    });
    return map;
  }, [trainers]);

  const refresh = useMemo(
    () => async () => {
      const [c, t] = await Promise.all([
        supabase
          .from("children")
          .select(
            "id, full_name, dob, school, medical_notes, age_group_label, status, trainer_id, parent:profiles!children_parent_id_fkey(id, full_name, phone)"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("trainers")
          .select(
            "id, active, profile:profiles!trainers_profile_id_fkey(full_name)"
          ),
      ]);
      if (c.error) {
        setError(c.error.message);
        setLoading(false);
        return;
      }
      const trainerOptions: TrainerOption[] = (
        (t.data as unknown as
          | {
              id: string;
              active: boolean;
              profile: { full_name: string } | null;
            }[]
          | null) ?? []
      )
        .filter(r => r.profile)
        .map(r => ({
          id: r.id,
          active: r.active,
          full_name: r.profile!.full_name,
        }));
      setTrainers(trainerOptions);
      setChildren((c.data ?? []) as unknown as ChildRow[]);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return children;
    return children.filter(c => {
      const trainerName = c.trainer_id ? (trainerNames[c.trainer_id] ?? "") : "";
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.parent?.full_name ?? "").toLowerCase().includes(q) ||
        trainerName.toLowerCase().includes(q)
      );
    });
  }, [children, search, trainerNames]);

  // Prune selection so it stays a subset of the visible filtered set.
  // Without this, a child filtered out by search stays "selected" invisibly.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visibleIds = new Set(filtered.map(c => c.id));
    let changed = false;
    const next = new Set<string>();
    selectedIds.forEach(id => {
      if (visibleIds.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) setSelectedIds(next);
  }, [filtered, selectedIds]);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const activeTrainers = useMemo(
    () => trainers.filter(t => t.active),
    [trainers]
  );

  const updateChildLocally = (id: string, patch: Partial<ChildRow>) => {
    setChildren(prev => prev.map(ch => (ch.id === id ? { ...ch, ...patch } : ch)));
  };

  const handleStatusChange = async (
    id: string,
    newStatus: ChildRow["status"]
  ) => {
    const { error: upErr } = await supabase
      .from("children")
      .update({ status: newStatus })
      .eq("id", id);
    if (upErr) {
      setError(upErr.message);
      toast.error("Nu am putut actualiza statusul", { description: upErr.message });
    } else {
      updateChildLocally(id, { status: newStatus });
    }
  };

  const bulkTransferTo = async (trainerId: string) => {
    if (selectedIds.size === 0 || bulkBusy) return;
    const ids = Array.from(selectedIds);
    const trainer = trainers.find(t => t.id === trainerId);
    setBulkBusy(true);
    const toastId = toast.loading(
      `Transfer ${ids.length} copii la ${trainer?.full_name ?? "antrenor"}…`
    );
    const { error: upErr } = await supabase
      .from("children")
      .update({ trainer_id: trainerId })
      .in("id", ids);
    setBulkBusy(false);
    if (upErr) {
      setError(upErr.message);
      toast.error("Transferul a eșuat", {
        id: toastId,
        description: upErr.message,
      });
      return;
    }
    toast.success(
      `${ids.length} ${ids.length === 1 ? "copil mutat" : "copii mutați"} la ${trainer?.full_name ?? "antrenor"}.`,
      { id: toastId }
    );
    clearSelection();
    await refresh();
  };

  const bulkStatusChange = async (newStatus: ChildRow["status"]) => {
    if (selectedIds.size === 0 || bulkBusy) return;
    const ids = Array.from(selectedIds);
    const label = STATUS_LABEL[newStatus];
    setBulkBusy(true);
    const toastId = toast.loading(
      `Actualizez statusul pentru ${ids.length} copii…`
    );
    const { error: upErr } = await supabase
      .from("children")
      .update({ status: newStatus })
      .in("id", ids);
    setBulkBusy(false);
    if (upErr) {
      setError(upErr.message);
      toast.error("Schimbarea statusului a eșuat", {
        id: toastId,
        description: upErr.message,
      });
      return;
    }
    toast.success(
      `${ids.length} ${ids.length === 1 ? "copil marcat" : "copii marcați"} ca ${label}.`,
      { id: toastId }
    );
    clearSelection();
    await refresh();
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Caută după copil, părinte sau antrenor"
          className="touch-target w-full flex-1 rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60 sm:w-auto"
        />
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/70">
          {filtered.length} {filtered.length === 1 ? "copil afișat" : "copii afișați"}
        </span>
        <button
          type="button"
          onClick={() => refresh()}
          className="touch-target inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 hover:border-brand-cyan/40 hover:text-white"
        >
          <RefreshCcw className="size-3.5" />
          Reîncarcă
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-cyan/30 bg-[oklch(0.14_0.05_220)]/95 p-3 shadow-lg backdrop-blur">
          <span className="font-heading text-[11px] uppercase tracking-[0.18em] text-brand-cyan">
            {selectedIds.size} selectați
          </span>

          <div className="ml-1 inline-flex items-center gap-2">
            <ArrowRightLeft className="size-3.5 text-white/55" />
            <select
              value=""
              disabled={bulkBusy || activeTrainers.length === 0}
              onChange={e => {
                const v = e.target.value;
                if (v) bulkTransferTo(v);
              }}
              className="rounded-lg border border-white/10 bg-[oklch(0.10_0.02_250)] px-2 py-1 font-heading text-[10px] uppercase tracking-[0.12em] text-white/80 disabled:opacity-50"
            >
              <option value="">Transferă la antrenor…</option>
              {activeTrainers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkStatusChange("paused")}
            className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-amber-200 hover:bg-amber-300/20 disabled:opacity-50"
          >
            Marchează ca pauzat
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkStatusChange("active")}
            className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-emerald-200 hover:bg-emerald-300/20 disabled:opacity-50"
          >
            Marchează ca activ
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={clearSelection}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/70 hover:text-white disabled:opacity-50"
          >
            <X className="size-3" />
            Anulează selecția
          </button>
          {bulkBusy && <Loader2 className="size-3.5 animate-spin text-brand-cyan" />}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
          {error}
        </p>
      )}
      {loading && (
        <Loader2 className="mx-auto size-5 animate-spin text-brand-cyan" />
      )}
      {!loading && filtered.length === 0 && <Empty hint="Niciun rezultat." />}

      <div className="grid gap-3">
        {filtered.map(c => (
          <ChildCard
            key={c.id}
            child={c}
            trainerName={
              c.trainer_id ? (trainerNames[c.trainer_id] ?? "Antrenor") : null
            }
            selected={selectedIds.has(c.id)}
            onToggleSelect={() => toggleSelected(c.id)}
            onStatusChange={newStatus => handleStatusChange(c.id, newStatus)}
            onSaved={patch => updateChildLocally(c.id, patch)}
            onError={msg => setError(msg)}
          />
        ))}
      </div>
    </div>
  );
}

function ChildCard({
  child,
  trainerName,
  selected,
  onToggleSelect,
  onStatusChange,
  onSaved,
  onError,
}: {
  child: ChildRow;
  trainerName: string | null;
  selected: boolean;
  onToggleSelect: () => void;
  onStatusChange: (s: ChildRow["status"]) => void;
  onSaved: (patch: Partial<ChildRow>) => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChildEditValues>({
    resolver: zodResolver(childEditSchema),
    defaultValues: {
      full_name: child.full_name,
      school: child.school ?? "",
      medical_notes: child.medical_notes ?? "",
    },
  });

  const startEdit = () => {
    reset({
      full_name: child.full_name,
      school: child.school ?? "",
      medical_notes: child.medical_notes ?? "",
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    reset({
      full_name: child.full_name,
      school: child.school ?? "",
      medical_notes: child.medical_notes ?? "",
    });
  };

  const onSubmit = handleSubmit(async v => {
    const patch = {
      full_name: v.full_name.trim(),
      school: v.school?.trim() ? v.school.trim() : null,
      medical_notes: v.medical_notes?.trim() ? v.medical_notes.trim() : null,
    };
    const { error: upErr } = await supabase
      .from("children")
      .update(patch)
      .eq("id", child.id);
    if (upErr) {
      onError(upErr.message);
      toast.error("Salvarea a eșuat", { description: upErr.message });
      return;
    }
    onSaved(patch);
    toast.success("Datele copilului au fost actualizate.");
    setEditing(false);
  });

  return (
    <article
      className={`rounded-2xl border bg-[oklch(0.13_0.03_250)]/70 p-4 transition-colors ${
        selected ? "border-brand-cyan/50" : "border-white/8"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Selectează ${child.full_name}`}
            className="mt-1 size-4 cursor-pointer rounded border-white/20 bg-[oklch(0.10_0.02_250)] accent-brand-cyan"
          />
          <div>
            <h3 className="font-heading text-base font-semibold uppercase tracking-[0.04em] text-white">
              {child.full_name}
            </h3>
            <p className="mt-0.5 font-body text-xs text-white/55">
              {currentAge(child.dob)} ani · {child.age_group_label ?? "Nealocat"}
              {child.parent && ` · Părinte: ${child.parent.full_name}`}
              {child.parent?.phone && ` · ${child.parent.phone}`}
            </p>
            {!editing && (child.school || child.medical_notes) && (
              <p className="mt-1 font-body text-xs text-white/45">
                {child.school && <>Școală: {child.school}</>}
                {child.school && child.medical_notes && " · "}
                {child.medical_notes && <>Medical: {child.medical_notes}</>}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 hover:border-brand-cyan/40 hover:text-white"
            >
              <Pencil className="size-3" />
              Editează
            </button>
          )}
          <select
            value={child.status}
            onChange={e => onStatusChange(e.target.value as ChildRow["status"])}
            className="rounded-lg border border-white/10 bg-[oklch(0.10_0.02_250)] px-2 py-1 font-heading text-[10px] uppercase tracking-[0.12em] text-white/70"
          >
            <option value="active">Activ</option>
            <option value="paused">Pauză</option>
            <option value="left">Plecat</option>
            <option value="closed_unpaid">Cont închis</option>
            <option value="transferred">Transferat</option>
          </select>
          <span
            className={`rounded-full border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] ${
              child.trainer_id
                ? "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"
                : "border-amber-300/30 bg-amber-300/10 text-amber-200"
            }`}
          >
            {trainerName ?? "Nealocat"}
          </span>
        </div>
      </div>

      {editing && (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 border-t border-white/8 pt-4">
          <BrandedField
            htmlFor={`edit-name-${child.id}`}
            label="Nume complet"
            error={errors.full_name?.message}
            required
          >
            <input
              id={`edit-name-${child.id}`}
              type="text"
              {...register("full_name")}
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
          <BrandedField
            htmlFor={`edit-school-${child.id}`}
            label="Școală (opțional)"
            error={errors.school?.message}
          >
            <input
              id={`edit-school-${child.id}`}
              type="text"
              {...register("school")}
              placeholder="Ex: Școala 1, clasa a 3-a"
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
          <BrandedField
            htmlFor={`edit-medical-${child.id}`}
            label="Note medicale (opțional, max 1000)"
            error={errors.medical_notes?.message}
          >
            <textarea
              id={`edit-medical-${child.id}`}
              rows={3}
              {...register("medical_notes")}
              placeholder="Alergii, condiții relevante pentru antrenor…"
              className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
            />
          </BrandedField>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="size-3.5" />
                  Salvează
                </>
              )}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 hover:text-white disabled:opacity-60"
            >
              <X className="size-3" />
              Anulează
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

// ─── Landing tab ──────────────────────────────────────────────────────────────

function LandingTab() {
  const [rows, setRows] = useState<LandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [hero, setHero] = useState({ tagline: "", badge: "" });
  const [owner, setOwner] = useState({ name: "", role: "", quote: "" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("landing_content")
      .select("id, slot, payload")
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        const list = (data ?? []) as LandingRow[];
        setRows(list);
        const h = list.find(r => r.slot === "hero");
        const o = list.find(r => r.slot === "owner");
        if (h)
          setHero({
            tagline: (h.payload.tagline as string | undefined) ?? "",
            badge: (h.payload.badge as string | undefined) ?? "",
          });
        if (o)
          setOwner({
            name: (o.payload.name as string | undefined) ?? "",
            role: (o.payload.role as string | undefined) ?? "",
            quote: (o.payload.quote as string | undefined) ?? "",
          });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setError(null);
    setOkMsg(null);
    const heroRow = rows.find(r => r.slot === "hero");
    const ownerRow = rows.find(r => r.slot === "owner");

    const { error: hErr } = await supabase
      .from("landing_content")
      .upsert(
        { slot: "hero", payload: { ...(heroRow?.payload ?? {}), ...hero } },
        { onConflict: "slot" }
      );
    const { error: oErr } = await supabase
      .from("landing_content")
      .upsert(
        { slot: "owner", payload: { ...(ownerRow?.payload ?? {}), ...owner } },
        { onConflict: "slot" }
      );
    if (hErr || oErr) {
      setError(hErr?.message ?? oErr?.message ?? "Eroare la salvare.");
      return;
    }
    setOkMsg("Conținut actualizat. Schimbările apar pe /cunoaste.");
  };

  if (loading)
    return <Loader2 className="mx-auto size-5 animate-spin text-brand-cyan" />;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5">
        <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
          Hero (pagina /)
        </h2>
        <div className="mt-3 grid gap-3">
          <BrandedField htmlFor="hero-badge" label="Eticheta de sus">
            <input
              id="hero-badge"
              type="text"
              value={hero.badge}
              onChange={e => setHero(h => ({ ...h, badge: e.target.value }))}
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
          <div>
            <label className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
              Slogan
            </label>
            <textarea
              rows={3}
              value={hero.tagline}
              onChange={e => setHero(h => ({ ...h, tagline: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5">
        <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
          Slide Owner (pagina /cunoaste)
        </h2>
        <div className="mt-3 grid gap-3">
          <BrandedField htmlFor="owner-name" label="Nume">
            <input
              id="owner-name"
              type="text"
              value={owner.name}
              onChange={e => setOwner(o => ({ ...o, name: e.target.value }))}
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
          <BrandedField htmlFor="owner-role" label="Rol">
            <input
              id="owner-role"
              type="text"
              value={owner.role}
              onChange={e => setOwner(o => ({ ...o, role: e.target.value }))}
              className={LOCAL_INPUT_CLS}
            />
          </BrandedField>
          <div>
            <label className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
              Citat
            </label>
            <textarea
              rows={4}
              value={owner.quote}
              onChange={e => setOwner(o => ({ ...o, quote: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
            />
          </div>
        </div>
      </section>

      <div className="lg:col-span-2">
        {error && (
          <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
            {error}
          </p>
        )}
        {okMsg && (
          <p className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 font-body text-xs text-emerald-200">
            {okMsg}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          className="touch-target mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-5 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)]"
        >
          Salvează conținutul
        </button>
      </div>
    </div>
  );
}

// ─── lazy tab wrapper (prevents all tabs mounting at once) ───────────────────

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

// ─── shared bits ──────────────────────────────────────────────────────────────

const Empty = ({ hint }: { hint: string }) => (
  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center font-body text-sm text-white/55">
    {hint}
  </div>
);

