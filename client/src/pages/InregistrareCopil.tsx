/**
 * /inregistrare/copil — parent onboarding step 2.
 *
 * One-page form (intentionally not a multi-step wizard for v1) with:
 *   - child name, DOB, gender, school, medical notes
 *   - DOB → live computed age + suggested age group
 *   - DOB → live trainer match list (those whose [age_min, age_max] contains age)
 *   - parent picks one trainer (or "without trainer for now" if no match)
 *
 * On submit we insert into fotbal.children. The DB trigger writes the
 * `signup` + (optionally) `group_assigned` rows in fotbal.player_events.
 */
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { currentAge, ageGroupLabel } from "@/lib/age";
import MemberShell from "@/components/MemberShell";

type TrainerRow = {
  id: string;
  age_min: number;
  age_max: number;
  active: boolean;
  display_order: number;
  position: string | null;
  bio: string | null;
  hero_photo_path: string | null;
  profile: { full_name: string } | null;
};

const schema = z.object({
  fullName: z.string().min(2, "Numele complet").max(120),
  dob: z
    .string()
    .min(1, "Data nașterii")
    .refine(v => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d < new Date();
    }, "Dată invalidă"),
  gender: z.enum(["M", "F", "X"]),
  school: z.string().max(120).optional().or(z.literal("")),
  medicalNotes: z.string().max(2000).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export default function InregistrareCopil() {
  const { profile } = useAuth();
  const [, navigate] = useLocation();
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(
    null
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { gender: "M", school: "", medicalNotes: "" },
  });

  const dob = watch("dob");
  const age = useMemo(() => (dob ? currentAge(dob) : null), [dob]);
  const groupLabel = useMemo(
    () => (age != null ? ageGroupLabel(age) : null),
    [age]
  );

  // Load trainers (public read)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("trainers")
        .select(
          "id, age_min, age_max, active, display_order, position, bio, hero_photo_path, profile:profiles(full_name)"
        )
        .eq("active", true)
        .order("display_order", { ascending: true });
      if (cancelled) return;
      if (error) {
        setServerError(`Nu am putut încărca antrenorii: ${error.message}`);
        return;
      }
      setTrainers((data ?? []) as unknown as TrainerRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const matchedTrainers = useMemo(() => {
    if (age == null) return trainers;
    return trainers.filter(t => age >= t.age_min && age <= t.age_max);
  }, [age, trainers]);

  // Auto-select first match when DOB changes and no manual pick yet
  useEffect(() => {
    if (selectedTrainerId) return;
    if (matchedTrainers.length === 1)
      setSelectedTrainerId(matchedTrainers[0].id);
  }, [matchedTrainers, selectedTrainerId]);

  const onSubmit = handleSubmit(async values => {
    setServerError(null);
    if (!profile) {
      setServerError("Profil indisponibil. Re-autentifică-te.");
      return;
    }
    const { data, error } = await supabase
      .from("children")
      .insert({
        parent_id: profile.id,
        full_name: values.fullName,
        dob: values.dob,
        gender: values.gender,
        school: values.school || null,
        medical_notes: values.medicalNotes || null,
        trainer_id: selectedTrainerId,
        age_group_label: groupLabel,
      })
      .select("id")
      .single();
    if (error || !data) {
      setServerError(error?.message ?? "Eroare la salvare.");
      return;
    }
    navigate(`/copil/${data.id}`);
  });

  return (
    <MemberShell>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="font-heading text-[10px] font-medium uppercase tracking-[0.3em] text-brand-cyan/80">
            Înscriere · Pasul 2 / 2
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-brand-cyan/30 via-white/10 to-transparent" />
        </div>
        <h1 className="mt-3 font-heading text-3xl font-bold uppercase leading-[1.05] tracking-[0.02em] sm:text-4xl">
          <span className="block text-white/55">Profilul</span>
          <span className="text-gradient-cyan">copilului</span>
        </h1>
        <p className="mt-3 max-w-xl font-body text-sm leading-relaxed text-white/60 sm:text-base">
          Completează datele de bază. În funcție de data nașterii, alegi
          antrenorul potrivit pentru grupa lui.
        </p>

        <form onSubmit={onSubmit} className="mt-8 grid gap-6">
          {/* Identity card */}
          <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7">
            <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
              Date de bază
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                id="fullName"
                label="Numele copilului"
                placeholder="ex. Andrei Popescu"
                error={errors.fullName?.message}
                {...register("fullName")}
              />
              <Field
                id="dob"
                label="Data nașterii"
                type="date"
                error={errors.dob?.message}
                {...register("dob")}
              />
              <div>
                <label
                  htmlFor="gender"
                  className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
                >
                  Gen
                </label>
                <select
                  id="gender"
                  {...register("gender")}
                  className="touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-3 font-body text-base text-white outline-none focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/20"
                >
                  <option value="M">Băiat</option>
                  <option value="F">Fată</option>
                  <option value="X">Nu specifică</option>
                </select>
              </div>
              <Field
                id="school"
                label="Școală (opțional)"
                placeholder="ex. Școala 16 Cluj-Napoca"
                error={errors.school?.message}
                {...register("school")}
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="medicalNotes"
                className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
              >
                Note medicale (opțional)
              </label>
              <textarea
                id="medicalNotes"
                rows={3}
                placeholder="Alergii, afecțiuni, restricții, contact medic familie…"
                {...register("medicalNotes")}
                className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-3 font-body text-base text-white placeholder:text-white/25 outline-none focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/20"
              />
            </div>
          </section>

          {/* Trainer matcher */}
          <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
                Antrenor & grupă
              </h2>
              {age != null && (
                <span className="rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan">
                  Vârstă {age} · Grupa {groupLabel}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {age == null && (
                <p className="col-span-full rounded-xl border border-white/8 bg-white/[0.02] p-4 font-body text-sm text-white/55">
                  Completează data nașterii ca să-ți arătăm antrenorii
                  potriviți.
                </p>
              )}
              {age != null && matchedTrainers.length === 0 && (
                <p className="col-span-full rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-4 font-body text-sm text-amber-100/85">
                  Niciun antrenor activ pentru vârsta {age}. Continuăm fără
                  repartizare — Dan va aloca grupa manual după înscriere.
                </p>
              )}
              {matchedTrainers.map(t => {
                const isSelected = selectedTrainerId === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() =>
                      setSelectedTrainerId(isSelected ? null : t.id)
                    }
                    className={`group relative flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-brand-cyan/60 bg-brand-cyan/[0.08] shadow-[0_18px_50px_-20px_oklch(0.75_0.12_230/0.4)]"
                        : "border-white/8 bg-white/[0.03] hover:border-brand-cyan/30 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-heading text-base font-semibold uppercase tracking-[0.04em] text-white">
                          {t.profile?.full_name ?? "Antrenor"}
                        </h3>
                        <p className="mt-0.5 font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan/85">
                          {t.position ?? `U${t.age_min}–U${t.age_max}`}
                        </p>
                      </div>
                      <span className="grid size-7 place-items-center rounded-full border border-brand-cyan/40 bg-brand-cyan/10 font-heading text-[10px] font-bold tabular-nums text-brand-cyan">
                        U{t.age_min}–{t.age_max}
                      </span>
                    </div>
                    {t.bio && (
                      <p className="mt-1 font-body text-sm leading-relaxed text-white/65">
                        {t.bio}
                      </p>
                    )}
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/60 to-transparent transition-opacity ${
                        isSelected
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-60"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {age != null && matchedTrainers.length === 0 && (
              <button
                type="button"
                onClick={() => setSelectedTrainerId(null)}
                className="mt-3 inline-flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.16em] text-white/55 hover:text-white/85"
              >
                <Users className="size-3.5" />
                Continuă fără antrenor (Dan va aloca grupa)
              </button>
            )}
          </section>

          {serverError && (
            <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="touch-target group inline-flex items-center justify-center gap-3 rounded-full bg-brand-cyan px-6 py-3.5 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] shadow-[0_10px_40px_-8px_oklch(0.75_0.12_230/0.6)] transition-all hover:-translate-y-0.5 hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Salvează profilul
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </MemberShell>
  );
}

const Field = ({
  id,
  label,
  type = "text",
  placeholder,
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
      placeholder={placeholder}
      {...rest}
      className="touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-3 font-body text-base text-white placeholder:text-white/25 outline-none focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/20"
    />
    {error && (
      <p className="mt-1 font-body text-xs text-rose-300/85">{error}</p>
    )}
  </div>
);
