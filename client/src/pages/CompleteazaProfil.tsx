/**
 * /completeaza-profil — gate shown after first-time Google sign-in.
 * Collects phone (required) and lets the user confirm/edit full_name.
 * Redirects to /dashboard on success.
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Loader2, Phone, User, Save } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import AuthCardShell from "@/components/AuthCardShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  fullName: z.string().min(2, "Numele complet este obligatoriu").max(120),
  phone: z
    .string()
    .min(1, "Numărul de telefon este obligatoriu")
    .regex(
      /^[\+]?[0-9\s\-\(\)]{8,20}$/,
      "Număr invalid (ex: 0712 345 678)"
    ),
});
type FormValues = z.infer<typeof schema>;

export default function CompleteazaProfil() {
  const { profile, refreshProfile } = useAuth();
  const [, navigate] = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", phone: "" },
  });

  // Pre-fill from existing profile
  useEffect(() => {
    if (profile) {
      setValue("fullName", profile.full_name ?? "");
      setValue("phone", profile.phone ?? "");
    }
  }, [profile, setValue]);

  const onSubmit = async (v: FormValues) => {
    setServerError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: v.fullName, phone: v.phone })
      .eq("id", profile!.id);

    if (error) {
      setServerError(`Eroare la salvare: ${error.message}`);
      return;
    }
    await refreshProfile();
    navigate("/dashboard");
  };

  return (
    <AuthCardShell
      eyebrow="Profil"
      title={
        <>
          <span className="block text-white/55">Completează</span>
          <span className="text-gradient-cyan">datele tale</span>
        </>
      }
      subtitle="Pentru ca antrenorii să te poată contacta, avem nevoie de numărul tău de telefon."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="space-y-2">
          <Label
            htmlFor="fullName"
            className="flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.16em] text-white/70"
          >
            <User className="size-3.5 text-brand-cyan" />
            Nume complet
          </Label>
          <Input
            id="fullName"
            placeholder="Ex: Popescu Ion"
            {...register("fullName")}
            className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-brand-cyan/60 focus-visible:ring-brand-cyan/20"
          />
          {errors.fullName && (
            <p className="font-body text-xs text-rose-300">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="phone"
            className="flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.16em] text-white/70"
          >
            <Phone className="size-3.5 text-brand-cyan" />
            Telefon
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="0712 345 678"
            {...register("phone")}
            className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-brand-cyan/60 focus-visible:ring-brand-cyan/20"
          />
          {errors.phone && (
            <p className="font-body text-xs text-rose-300">
              {errors.phone.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-cyan px-5 font-heading text-[12px] font-semibold uppercase tracking-[0.14em] text-[oklch(0.08_0.02_250)] shadow-[0_8px_28px_-8px_oklch(0.75_0.12_230/0.55)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Se salvează…
            </>
          ) : (
            <>
              <Save className="size-4" />
              Salvează și continuă
            </>
          )}
        </button>
      </form>
    </AuthCardShell>
  );
}
