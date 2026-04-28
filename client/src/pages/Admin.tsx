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
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Newspaper,
  RefreshCcw,
  Send,
  Users,
  UserPlus,
} from "lucide-react";
import MemberShell from "@/components/MemberShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { currentAge } from "@/lib/age";

type TrainerRow = {
  id: string;
  profile_id: string;
  position: string | null;
  bio: string | null;
  age_min: number;
  age_max: number;
  certifications: string[] | null;
  active: boolean;
  created_at: string;
  profile: { full_name: string; phone: string | null } | null;
  child_count?: number;
};

type ChildRow = {
  id: string;
  full_name: string;
  dob: string;
  age_group_label: string | null;
  status: "active" | "paused" | "left";
  trainer_id: string | null;
  parent: { id: string; full_name: string; phone: string | null } | null;
};

type LandingRow = {
  id: string;
  slot: "hero" | "owner" | "trainers" | "players";
  payload: Record<string, unknown>;
};

export default function Admin() {
  const { profile } = useAuth();
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

      <Tabs defaultValue="antrenori" className="mt-6">
        <TabsList className="flex w-full gap-1 overflow-x-auto rounded-full border border-white/8 bg-[oklch(0.10_0.02_250)] p-1">
          <Trigger value="antrenori" icon={<UserPlus className="size-3.5" />}>
            Antrenori
          </Trigger>
          <Trigger value="membri" icon={<Users className="size-3.5" />}>
            Membri
          </Trigger>
          <Trigger value="pagina" icon={<Newspaper className="size-3.5" />}>
            Pagina publică
          </Trigger>
        </TabsList>

        <TabsContent value="antrenori" className="mt-5">
          <TrainersTab />
        </TabsContent>
        <TabsContent value="membri" className="mt-5">
          <MembersTab />
        </TabsContent>
        <TabsContent value="pagina" className="mt-5">
          <LandingTab />
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
    className="flex-1 rounded-full px-3 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-white/65 data-[state=active]:bg-brand-cyan/15 data-[state=active]:text-brand-cyan"
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
      const { data, error } = await supabase
        .from("trainers")
        .select(
          "id, profile_id, position, bio, age_min, age_max, certifications, active, created_at, profile:profiles!trainers_profile_id_fkey(full_name, phone)"
        )
        .order("display_order", { ascending: true });
      if (error) {
        setServerError(error.message);
        setLoading(false);
        return;
      }
      // Pull child counts per trainer in one query, then merge.
      const counts = await supabase.from("children").select("trainer_id");
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
        <Field
          id="t-email"
          label="Email"
          type="email"
          {...register("email")}
          error={errors.email?.message}
          placeholder="antrenor@email.ro"
        />
        <Field
          id="t-name"
          label="Nume complet"
          {...register("fullName")}
          error={errors.fullName?.message}
          placeholder="Andrei Popa"
        />
        <Field
          id="t-phone"
          label="Telefon (opțional)"
          {...register("phone")}
          error={errors.phone?.message}
          placeholder="+40 7XX XXX XXX"
        />
        <Field
          id="t-whatsapp"
          label="WhatsApp (E.164)"
          {...register("whatsappNumber")}
          error={errors.whatsappNumber?.message}
          placeholder="+40744311147"
        />
        <Field
          id="t-position"
          label="Funcție"
          {...register("position")}
          error={errors.position?.message}
          placeholder="Antrenor U10–U12"
        />
        <Field
          id="t-agent"
          label="ElevenLabs Agent ID (opțional)"
          {...register("elevenlabsAgentId")}
          error={errors.elevenlabsAgentId?.message}
          placeholder="agent_xxx (lasă gol pentru asistentul implicit)"
        />
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
          <Field
            id="t-min"
            label="Vârstă min"
            type="number"
            min={4}
            max={25}
            {...register("ageMin", { valueAsNumber: true })}
            error={errors.ageMin?.message}
          />
          <Field
            id="t-max"
            label="Vârstă max"
            type="number"
            min={4}
            max={25}
            {...register("ageMax", { valueAsNumber: true })}
            error={errors.ageMax?.message}
          />
        </div>
        <Field
          id="t-certs"
          label="Certificări (separă prin virgulă)"
          {...register("certifications")}
          error={errors.certifications?.message}
          placeholder="UEFA C, Prim ajutor"
        />
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
            <article
              key={t.id}
              className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5"
            >
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
                  <button
                    type="button"
                    onClick={() => toggleActive(t)}
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
              {t.bio && (
                <p className="mt-2 font-body text-sm leading-relaxed text-white/65">
                  {t.bio}
                </p>
              )}
              {(t.certifications?.length ?? 0) > 0 && (
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
            </article>
          ))}
      </div>
    </div>
  );
}

// ─── Members tab ──────────────────────────────────────────────────────────────

function MembersTab() {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [trainerNames, setTrainerNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useMemo(
    () => async () => {
      const c = await supabase
        .from("children")
        .select(
          "id, full_name, dob, age_group_label, status, trainer_id, parent:profiles!children_parent_id_fkey(id, full_name, phone)"
        )
        .order("created_at", { ascending: false });
      if (c.error) {
        setError(c.error.message);
        setLoading(false);
        return;
      }
      const t = await supabase
        .from("trainers")
        .select("id, profile:profiles!trainers_profile_id_fkey(full_name)");
      const nameMap: Record<string, string> = {};
      (
        t.data as unknown as
          | { id: string; profile: { full_name: string } | null }[]
          | null
      )?.forEach(r => {
        if (r.profile) nameMap[r.id] = r.profile.full_name;
      });
      setTrainerNames(nameMap);
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
    return children.filter(
      c =>
        c.full_name.toLowerCase().includes(q) ||
        (c.parent?.full_name ?? "").toLowerCase().includes(q)
    );
  }, [children, search]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Caută după copil sau părinte"
          className="touch-target w-full flex-1 rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60 sm:w-auto"
        />
        <button
          type="button"
          onClick={() => refresh()}
          className="touch-target inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 hover:border-brand-cyan/40 hover:text-white"
        >
          <RefreshCcw className="size-3.5" />
          Reîncarcă
        </button>
      </div>

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
          <article
            key={c.id}
            className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h3 className="font-heading text-base font-semibold uppercase tracking-[0.04em] text-white">
                  {c.full_name}
                </h3>
                <p className="mt-0.5 font-body text-xs text-white/55">
                  {currentAge(c.dob)} ani · {c.age_group_label ?? "Nealocat"}
                  {c.parent && ` · Părinte: ${c.parent.full_name}`}
                  {c.parent?.phone && ` · ${c.parent.phone}`}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] ${
                  c.trainer_id
                    ? "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"
                    : "border-amber-300/30 bg-amber-300/10 text-amber-200"
                }`}
              >
                {c.trainer_id
                  ? (trainerNames[c.trainer_id] ?? "Antrenor")
                  : "Nealocat"}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
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
          <Field
            id="hero-badge"
            label="Eticheta de sus"
            value={hero.badge}
            onChange={e => setHero(h => ({ ...h, badge: e.target.value }))}
          />
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
          <Field
            id="owner-name"
            label="Nume"
            value={owner.name}
            onChange={e => setOwner(o => ({ ...o, name: e.target.value }))}
          />
          <Field
            id="owner-role"
            label="Rol"
            value={owner.role}
            onChange={e => setOwner(o => ({ ...o, role: e.target.value }))}
          />
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

// ─── shared bits ──────────────────────────────────────────────────────────────

const Empty = ({ hint }: { hint: string }) => (
  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center font-body text-sm text-white/55">
    {hint}
  </div>
);

const Field = ({
  id,
  label,
  type = "text",
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
}) => (
  <div>
    <label
      htmlFor={id}
      className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
    >
      {label}
    </label>
    <input
      id={id}
      type={type}
      {...rest}
      className="touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-3 font-body text-base text-white placeholder:text-white/25 focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/20"
    />
    {error && (
      <p className="mt-1 font-body text-xs text-rose-300/85">{error}</p>
    )}
  </div>
);
