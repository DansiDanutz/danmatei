/**
 * LeadForm — public lead-capture form.
 *
 * Submits to /api/lead/create. On success, surfaces the WhatsApp delivery
 * status and the call link as a fallback CTA.
 *
 * See docs/AI_CALL_FLOW.md for the full feature design.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, PhoneCall, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const Schema = z.object({
  parentName: z.string().trim().min(2, "Numele este obligatoriu").max(120),
  parentPhone: z
    .string()
    .trim()
    .min(7, "Numărul este prea scurt")
    .max(32)
    .regex(/^[+\d\s()-]+$/, "Folosește doar cifre și + - ( ) spațiu"),
  childName: z.string().trim().min(2, "Numele copilului este obligatoriu").max(120),
  childAge: z.preprocess(
    (value) => (value === "" || value == null ? undefined : Number(value)),
    z
    .number({ error: "Vârsta este obligatorie" })
    .int("Vârsta este obligatorie")
    .min(4, "Minim 4 ani")
    .max(18, "Maxim 18 ani"),
  ),
  childPosition: z.string().trim().max(60).optional(),
  consent: z
    .boolean()
    .refine((v) => v === true, "Consimțământul este obligatoriu"),
});

type Input = z.infer<typeof Schema>;
type FormInput = z.input<typeof Schema>;

type SubmitResult = {
  ok: true;
  leadId: string;
  trainerId: string;
  callLink: string;
  whatsapp: { sent: boolean; reason: string | null; messageId: string | null };
};

const TRAINER_NAME: Record<string, string> = {
  "t-sopi": "Sopi",
  "t-kelemen": "Kelemen Andrei",
  "t-dan": "Dan Matei",
};

export default function LeadForm() {
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormInput, unknown, Input>({
    resolver: zodResolver(Schema),
    defaultValues: {
      parentName: "",
      parentPhone: "",
      childName: "",
      childAge: "" as unknown as number,
      childPosition: "",
      consent: false,
    },
  });

  const onSubmit = async (values: Input) => {
    setSubmitError(null);
    try {
      const res = await fetch("/api/lead/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, source: "web" }),
      });
      const json = (await res.json()) as
        | SubmitResult
        | { error: string; detail?: string };
      if (!res.ok || !("ok" in json)) {
        throw new Error("detail" in json && json.detail ? json.detail : "Trimitere eșuată");
      }
      setResult(json);
      reset();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Trimitere eșuată");
    }
  };

  if (result) {
    const trainer = TRAINER_NAME[result.trainerId] ?? "antrenorul tău";
    return (
      <div className="rounded-3xl border border-brand-cyan/30 bg-[oklch(0.10_0.02_250)] p-6 text-center shadow-[0_24px_80px_-40px_oklch(0.78_0.13_210/0.65)] sm:p-8">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-brand-cyan/15 text-brand-cyan ring-1 ring-brand-cyan/35">
          <CheckCircle2 className="size-7" />
        </div>
        <h2 className="font-heading text-2xl text-white mb-2 sm:text-3xl">
          Mulțumim! Te contactăm imediat.
        </h2>
        <p className="text-white/70 leading-relaxed">
          {result.whatsapp.sent
            ? `Am trimis un link pe WhatsApp către numărul tău. Apasă-l pentru a vorbi pe loc cu ${trainer} (apel direct în browser, fără descărcări).`
            : "Apasă butonul de mai jos pentru a porni apelul AI cu un consilier al academiei."}
        </p>

        <a
          href={result.callLink}
          target="_self"
          className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-brand-cyan text-[oklch(0.08_0.02_250)] font-heading uppercase tracking-[0.16em] text-sm hover:opacity-90 transition"
        >
          <PhoneCall className="size-4" />
          Începe apelul
        </a>

        {!result.whatsapp.sent && result.whatsapp.reason ? (
          <p className="text-xs text-white/40 mt-4">
            (WhatsApp: {result.whatsapp.reason})
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 rounded-3xl border border-white/10 bg-[oklch(0.10_0.02_250)]/90 backdrop-blur-md p-5 shadow-[0_24px_80px_-48px_black] sm:p-8"
      noValidate
    >
      <div className="grid gap-2 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.06] p-4 text-left sm:grid-cols-3">
        {["Completezi datele", "Primești linkul", "Vorbești cu Andra"].map((step, index) => (
          <div key={step} className="flex items-center gap-2 text-xs text-white/70">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-cyan/15 font-heading text-[10px] text-brand-cyan ring-1 ring-brand-cyan/30">
              {index + 1}
            </span>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Numele tău" error={errors.parentName?.message}>
          <input
            {...register("parentName")}
            type="text"
            autoComplete="name"
            aria-invalid={!!errors.parentName}
            className={inputCls(!!errors.parentName)}
            placeholder="ex. Andrei Popescu"
          />
        </Field>
        <Field label="Telefon (WhatsApp)" error={errors.parentPhone?.message}>
          <input
            {...register("parentPhone")}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={!!errors.parentPhone}
            className={inputCls(!!errors.parentPhone)}
            placeholder="07XX XXX XXX"
          />
        </Field>
        <Field label="Numele copilului" error={errors.childName?.message}>
          <input
            {...register("childName")}
            type="text"
            aria-invalid={!!errors.childName}
            className={inputCls(!!errors.childName)}
            placeholder="ex. Luca"
          />
        </Field>
        <Field label="Vârsta copilului" error={errors.childAge?.message}>
          <input
            {...register("childAge")}
            type="number"
            min={4}
            max={18}
            inputMode="numeric"
            aria-invalid={!!errors.childAge}
            className={inputCls(!!errors.childAge)}
            placeholder="ex. 9"
          />
        </Field>
      </div>

      <Field label="Postul preferat (opțional)">
        <input
          {...register("childPosition")}
          type="text"
          className={inputCls(false)}
          placeholder="ex. atacant, mijlocaș, portar"
        />
      </Field>

      <Controller
        control={control}
        name="consent"
        render={({ field, fieldState }) => (
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75 cursor-pointer transition-colors hover:border-brand-cyan/25">
            <input
              type="checkbox"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[oklch(0.78_0.13_210)]"
            />
            <span>
              Sunt de acord ca datele mele să fie folosite pentru a fi contactat
              de academie. Apelul cu agentul AI este înregistrat și transcris
              pentru calitatea serviciului. Datele sunt șterse la cerere
              (GDPR).
              {fieldState.error ? (
                <span className="block text-red-400 text-xs mt-1">
                  {fieldState.error.message}
                </span>
              ) : null}
            </span>
          </label>
        )}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full mt-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-cyan px-5 py-4 text-center font-heading text-sm font-semibold uppercase tracking-[0.14em] text-[oklch(0.08_0.02_250)] transition hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-50 sm:tracking-[0.16em]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Se trimite...
          </>
        ) : (
          <>
            <PhoneCall className="size-4" />
            Primește linkul de apel
          </>
        )}
      </button>

      {submitError ? (
        <p className="text-sm text-red-400 text-center">{submitError}</p>
      ) : null}

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/45">
        <ShieldCheck className="size-3.5 text-brand-cyan/70" />
        WhatsApp în sub 1 minut · GDPR · Cluj-Napoca
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-white/55 mb-1.5 block">
        {label}
      </span>
      {children}
      {error ? <span className="text-red-300 text-xs mt-1.5 block">{error}</span> : null}
    </label>
  );
}

function inputCls(hasError: boolean): string {
  return [
    "w-full rounded-xl bg-white/[0.05] border px-4 py-3.5 text-white placeholder-white/34",
    "outline-none transition focus:bg-white/[0.08]",
    hasError
      ? "border-red-500/60 focus:border-red-400"
      : "border-white/10 focus:border-brand-cyan/50",
  ].join(" ");
}
