/**
 * LeadForm — public lead-capture form.
 *
 * Submits to /api/lead/create. On success, surfaces the WhatsApp delivery
 * status and the call link as a fallback CTA.
 *
 * See docs/AI_CALL_FLOW.md for the full feature design.
 */
import { zodResolver } from "@hookform/resolvers/zod";
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
  childAge: z.coerce
    .number()
    .int("Vârsta este obligatorie")
    .min(4, "Minim 4 ani")
    .max(18, "Maxim 18 ani"),
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
      <div className="rounded-3xl border border-brand-cyan/30 bg-[oklch(0.10_0.02_250)] p-8 text-center">
        <div className="text-5xl mb-3">✅</div>
        <h2 className="font-heading text-3xl text-white mb-2">
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
          📞 Începe apelul
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
      className="space-y-4 rounded-3xl border border-white/10 bg-[oklch(0.10_0.02_250)]/85 backdrop-blur-md p-6 sm:p-8"
      noValidate
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Numele tău" error={errors.parentName?.message}>
          <input
            {...register("parentName")}
            type="text"
            autoComplete="name"
            className={inputCls(!!errors.parentName)}
            placeholder="ex. Andrei Popescu"
          />
        </Field>
        <Field label="Telefon (WhatsApp)" error={errors.parentPhone?.message}>
          <input
            {...register("parentPhone")}
            type="tel"
            autoComplete="tel"
            className={inputCls(!!errors.parentPhone)}
            placeholder="07XX XXX XXX"
          />
        </Field>
        <Field label="Numele copilului" error={errors.childName?.message}>
          <input
            {...register("childName")}
            type="text"
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
          <label className="flex items-start gap-3 text-sm text-white/75 cursor-pointer">
            <input
              type="checkbox"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              className="mt-0.5 size-4 accent-[oklch(0.78_0.13_210)]"
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
        className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-brand-cyan text-[oklch(0.08_0.02_250)] font-heading uppercase tracking-[0.16em] text-sm hover:opacity-90 transition disabled:opacity-50"
      >
        {isSubmitting ? "Se trimite..." : "Vreau să fiu sunat acum"}
      </button>

      {submitError ? (
        <p className="text-sm text-red-400 text-center">{submitError}</p>
      ) : null}

      <p className="text-xs text-white/40 text-center pt-2">
        Te sunăm în &lt;1 min via WhatsApp · GDPR · Cluj-Napoca
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
      {error ? <span className="text-red-400 text-xs mt-1 block">{error}</span> : null}
    </label>
  );
}

function inputCls(hasError: boolean): string {
  return [
    "w-full rounded-xl bg-white/[0.04] border px-4 py-3 text-white placeholder-white/30",
    "outline-none transition focus:bg-white/[0.07]",
    hasError
      ? "border-red-500/60 focus:border-red-400"
      : "border-white/10 focus:border-brand-cyan/50",
  ].join(" ");
}
