/**
 * NotificationManager — Owner-only broadcast notifications.
 *
 * Targets:
 *   - Toți părinții         → every parent with an active child
 *   - Grupă (antrenor)      → parents of children in that trainer's group
 *   - Antrenor specific     → direct notification to one trainer
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, Loader2, Send, Users, User, UsersRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const notifySchema = z.object({
  target: z.enum(["all_parents", "group", "trainer"]),
  trainerId: z.string().optional(),
  title: z.string().min(2, "Titlu prea scurt").max(200),
  body: z.string().min(2, "Mesaj prea scurt").max(2000),
  link: z.string().max(500).optional(),
});
type NotifyValues = z.infer<typeof notifySchema>;

type TrainerOption = {
  id: string;
  profile_id: string;
  full_name: string;
};

export default function NotificationManager() {
  const { session } = useAuth();
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NotifyValues>({
    resolver: zodResolver(notifySchema),
    defaultValues: { target: "all_parents", title: "", body: "", link: "" },
  });
  const target = watch("target");

  useEffect(() => {
    supabase
      .from("trainers")
      .select("id, profile_id, profile:profiles!trainers_profile_id_fkey(full_name)")
      .eq("active", true)
      .then(({ data, error }) => {
        if (!error && data) {
          setTrainers(
            (data as any[]).map((t) => ({
              id: t.id,
              profile_id: t.profile_id,
              full_name: t.profile?.full_name ?? "—",
            }))
          );
        }
        setLoadingTrainers(false);
      });
  }, []);

  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    setOkMsg(null);

    const selectedTrainer = trainers.find((t) => t.id === v.trainerId);

    const res = await fetch("/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        target: v.target,
        trainerId: v.target === "group" ? v.trainerId : null,
        trainerProfileId: v.target === "trainer" ? selectedTrainer?.profile_id : null,
        title: v.title,
        body: v.body,
        link: v.link || null,
      }),
    });

    const result = await res.json().catch(() => ({ error: "Eroare de rețea" }));
    if (!res.ok) {
      setServerError(result.error ?? "Eroare la trimitere");
      return;
    }

    setOkMsg(`Notificare trimisă către ${result.sent} destinatari.`);
    reset({ target: v.target, title: "", body: "", link: "" });
  });

  return (
    <div className="mx-auto max-w-2xl">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-6"
      >
        <h2 className="flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
          <Bell className="size-4 text-brand-cyan" />
          Notificare nouă
        </h2>

        {/* Target selector */}
        <div className="grid gap-2">
          <label className="font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            Destinatar
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: "all_parents", label: "Toți părinții", icon: Users },
              { key: "group", label: "Grupă", icon: UsersRound },
              { key: "trainer", label: "Antrenor", icon: User },
            ] as const).map((opt) => {
              const Icon = opt.icon;
              const active = target === opt.key;
              return (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-3 py-3 text-center font-heading text-[10px] uppercase tracking-[0.12em] transition-colors ${
                    active
                      ? "border-brand-cyan/60 bg-brand-cyan/10 text-brand-cyan"
                      : "border-white/10 bg-white/[0.03] text-white/65 hover:text-white"
                  }`}
                >
                  <input
                    type="radio"
                    value={opt.key}
                    {...register("target")}
                    className="sr-only"
                  />
                  <Icon className="size-4" />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* Trainer selector for group / trainer targets */}
        {(target === "group" || target === "trainer") && (
          <div>
            <label
              htmlFor="notify-trainer"
              className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
            >
              {target === "group" ? "Grupa (antrenor)" : "Antrenor"}
            </label>
            <select
              id="notify-trainer"
              {...register("trainerId")}
              className="touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white focus:border-brand-cyan/60"
            >
              <option value="">Alege antrenorul…</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            {loadingTrainers && (
              <p className="mt-1 flex items-center gap-1 font-body text-xs text-white/40">
                <Loader2 className="size-3 animate-spin" />
                Se încarcă antrenorii…
              </p>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label
            htmlFor="notify-title"
            className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
          >
            Titlu
          </label>
          <input
            id="notify-title"
            {...register("title")}
            placeholder="Ex: Anunț important"
            className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
          />
          {errors.title && (
            <p className="mt-1 font-body text-xs text-rose-300/85">
              {errors.title.message}
            </p>
          )}
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="notify-body"
            className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
          >
            Mesaj
          </label>
          <textarea
            id="notify-body"
            rows={5}
            {...register("body")}
            placeholder="Scrie mesajul aici…"
            className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
          />
          {errors.body && (
            <p className="mt-1 font-body text-xs text-rose-300/85">
              {errors.body.message}
            </p>
          )}
        </div>

        {/* Optional link */}
        <div>
          <label
            htmlFor="notify-link"
            className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
          >
            Link opțional
          </label>
          <input
            id="notify-link"
            {...register("link")}
            placeholder="/program sau https://…"
            className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
          />
        </div>

        {serverError && (
          <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
            {serverError}
          </p>
        )}
        {okMsg && (
          <p className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 font-body text-sm text-emerald-200">
            {okMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-cyan px-5 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-[oklch(0.08_0.02_250)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Trimite notificarea
        </button>
      </form>
    </div>
  );
}
