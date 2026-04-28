/**
 * Admin → Grupe tab.
 * Owner creates age-year groups, assigns them to trainers,
 * and manually assigns unregistered children to any group/trainer.
 */
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Plus,
  Save,
  UsersRound,
  UserCheck,
  UserX,
  ArrowRightLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GroupRow = {
  id: string;
  label: string;
  birth_year_min: number;
  birth_year_max: number;
  trainer_id: string | null;
  active: boolean;
  trainer: { profile: { full_name: string } | null } | null;
};

type TrainerOption = {
  id: string;
  profile: { full_name: string } | null;
};

type UnassignedChild = {
  id: string;
  full_name: string;
  dob: string;
  parent: { full_name: string; phone: string | null } | null;
};

const groupSchema = z.object({
  label: z.string().min(1, "Denumirea este obligatorie").max(60),
  birthYearMin: z.number().min(2000).max(2030),
  birthYearMax: z.number().min(2000).max(2030),
  trainerId: z.string().optional(),
});
type GroupForm = z.infer<typeof groupSchema>;

export default function GroupsTab() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
    defaultValues: { label: "", birthYearMin: 2015, birthYearMax: 2015 },
  });

  const loadAll = async () => {
    setServerError(null);
    const [{ data: g, error: ge }, { data: t, error: te }, { data: u, error: ue }] =
      await Promise.all([
        supabase
          .from("groups")
          .select("id, label, birth_year_min, birth_year_max, trainer_id, active, trainer:trainers(profile:profiles(full_name))")
          .order("birth_year_min", { ascending: false }),
        supabase
          .from("trainers")
          .select("id, profile:profiles(full_name)")
          .eq("active", true)
          .order("display_order", { ascending: true }),
        supabase
          .from("children")
          .select("id, full_name, dob, parent:profiles(full_name, phone)")
          .is("trainer_id", null)
          .eq("status", "active")
          .order("dob", { ascending: true }),
      ]);

    if (ge || te || ue) {
      setServerError(
        [ge?.message, te?.message, ue?.message].filter(Boolean).join("; ")
      );
    }
    setGroups((g ?? []) as unknown as GroupRow[]);
    setTrainers((t ?? []) as unknown as TrainerOption[]);
    setUnassigned((u ?? []) as unknown as UnassignedChild[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const onCreate = async (v: GroupForm) => {
    if (v.birthYearMax < v.birthYearMin) {
      setServerError("Anul maxim trebuie să fie ≥ anul minim.");
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const { error } = await supabase.from("groups").insert({
        label: v.label,
        birth_year_min: v.birthYearMin,
        birth_year_max: v.birthYearMax,
        trainer_id: v.trainerId || null,
      });
      if (error) {
        setServerError(error.message);
        return;
      }
      reset();
      loadAll();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  };

  const assignGroupTrainer = async (groupId: string, trainerId: string | null) => {
    try {
      const { error } = await supabase
        .from("groups")
        .update({ trainer_id: trainerId })
        .eq("id", groupId);
      if (error) setServerError(error.message);
      else loadAll();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Eroare");
    }
  };

  const toggleGroupActive = async (groupId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from("groups")
        .update({ active })
        .eq("id", groupId);
      if (error) setServerError(error.message);
      else loadAll();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Eroare");
    }
  };

  const assignChildToTrainer = async (childId: string, trainerId: string) => {
    try {
      const { error } = await supabase
        .from("children")
        .update({ trainer_id: trainerId, assignment_status: "accepted" })
        .eq("id", childId);
      if (error) setServerError(error.message);
      else loadAll();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Eroare");
    }
  };

  const trainerName = (t?: TrainerOption | null) => t?.profile?.full_name ?? "—";

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="size-5 animate-spin text-brand-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Create group */}
      <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-[0.02em] text-white">
          <Plus className="size-5 text-brand-cyan" />
          Grupă nouă
        </h2>
        <p className="mt-1 font-body text-sm text-white/55">
          Creează o grupă pe ani de naștere și atribuie-i un antrenor.
        </p>

        <form onSubmit={handleSubmit(onCreate)} className="mt-5 grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <Label className="font-heading text-[10px] uppercase tracking-[0.16em] text-white/60">
              Denumire
            </Label>
            <Input
              {...register("label")}
              placeholder="U10"
              className="mt-1.5 h-10 rounded-xl border-white/10 bg-white/[0.04] text-white"
            />
            {errors.label && (
              <p className="mt-1 font-body text-xs text-rose-300">{errors.label.message}</p>
            )}
          </div>
          <div>
            <Label className="font-heading text-[10px] uppercase tracking-[0.16em] text-white/60">
              An min
            </Label>
            <Input
              type="number"
              {...register("birthYearMin", { valueAsNumber: true })}
              className="mt-1.5 h-10 rounded-xl border-white/10 bg-white/[0.04] text-white"
            />
          </div>
          <div>
            <Label className="font-heading text-[10px] uppercase tracking-[0.16em] text-white/60">
              An max
            </Label>
            <Input
              type="number"
              {...register("birthYearMax", { valueAsNumber: true })}
              className="mt-1.5 h-10 rounded-xl border-white/10 bg-white/[0.04] text-white"
            />
          </div>
          <div>
            <Label className="font-heading text-[10px] uppercase tracking-[0.16em] text-white/60">
              Antrenor
            </Label>
            <select
              {...register("trainerId")}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-brand-cyan/60"
            >
              <option value="">— Fără antrenor —</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.profile?.full_name ?? "Antrenor"}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-cyan px-4 font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[oklch(0.08_0.02_250)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Salvează grupa
            </button>
            {serverError && (
              <p className="mt-2 font-body text-xs text-rose-300">{serverError}</p>
            )}
          </div>
        </form>
      </section>

      {/* Groups list */}
      <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-[0.02em] text-white">
          <UsersRound className="size-5 text-brand-cyan" />
          Grupe active
        </h2>
        {groups.length === 0 ? (
          <p className="mt-4 font-body text-sm text-white/50">Nicio grupă creată încă.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <div
                key={g.id}
                className={`rounded-2xl border p-4 transition-opacity ${
                  g.active ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-sm font-bold uppercase tracking-[0.02em] text-white">
                      {g.label}
                    </h3>
                    <p className="mt-0.5 font-body text-xs text-white/55">
                      {g.birth_year_min}–{g.birth_year_max}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleGroupActive(g.id, !g.active)}
                    className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-brand-cyan"
                    title={g.active ? "Dezactivează" : "Activează"}
                  >
                    {g.active ? <UserCheck className="size-4" /> : <UserX className="size-4" />}
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <ArrowRightLeft className="size-3.5 text-white/40" />
                  <select
                    value={g.trainer_id ?? ""}
                    onChange={(e) => assignGroupTrainer(g.id, e.target.value || null)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-cyan/60"
                  >
                    <option value="">— Fără antrenor —</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.profile?.full_name ?? "Antrenor"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Unassigned children */}
      <section className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 sm:p-7">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-[0.02em] text-white">
          <UserX className="size-5 text-rose-300" />
          Copii fără antrenor
        </h2>
        <p className="mt-1 font-body text-sm text-white/55">
          Acești copii nu sunt repartizați la nicio grupă. Poți să-i atribui manual unui antrenor.
        </p>

        {unassigned.length === 0 ? (
          <p className="mt-4 font-body text-sm text-white/50">
            Toți copiii activi sunt repartizați. 🎉
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {unassigned.map((c) => {
              const birthYear = new Date(c.dob).getFullYear();
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
                >
                  <div>
                    <p className="font-heading text-sm font-semibold text-white">{c.full_name}</p>
                    <p className="font-body text-xs text-white/50">
                      {birthYear} · Părinte: {c.parent?.full_name ?? "—"}
                      {c.parent?.phone ? ` · ${c.parent.phone}` : ""}
                    </p>
                  </div>
                  <select
                    onChange={(e) => {
                      if (e.target.value) assignChildToTrainer(c.id, e.target.value);
                    }}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white outline-none focus:border-brand-cyan/60"
                    defaultValue=""
                  >
                    <option value="">Atribuie antrenor…</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.profile?.full_name ?? "Antrenor"}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
