/**
 * /inregistrare — single-button Google OAuth signup. First-time Google
 * sign-in creates the auth user; the AuthProvider listener picks up the
 * session and the post-redirect flow routes the parent to the child
 * profile wizard. No passwords, no email verification — Google handles
 * identity for us.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import AuthCardShell from "@/components/AuthCardShell";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { useAuth } from "@/lib/auth";

export default function Inregistrare() {
  const { signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleGoogle = async (): Promise<void> => {
    setServerError(null);
    setSubmitting(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setServerError(error);
      setSubmitting(false);
    }
  };

  return (
    <AuthCardShell
      eyebrow="Înscriere · Părinte"
      title={
        <>
          <span className="block text-white/55">Hai să-l înscriem</span>
          <span className="text-gradient-cyan">în academie</span>
        </>
      }
      subtitle="Creează contul de părinte cu Google. Apoi adăugăm profilul copilului și îl repartizăm la antrenorul potrivit. Fără parole, fără emailuri de confirmare."
      footer={
        <>
          Ai deja cont?{" "}
          <Link
            href="/login"
            className="font-heading uppercase tracking-[0.16em] text-brand-cyan hover:underline"
          >
            Conectează-te
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <GoogleAuthButton
          label="Continuă cu Google"
          loadingLabel="Te ducem la Google…"
          onClick={handleGoogle}
          loading={submitting}
        />

        {serverError && (
          <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
            {serverError}
          </p>
        )}

        {submitting && !serverError && (
          <p className="inline-flex items-center justify-center gap-2 font-body text-xs text-white/55">
            <Loader2 className="size-3 animate-spin" />
            Așteaptă redirecționarea…
          </p>
        )}

        <ul className="grid gap-2 rounded-xl border border-brand-cyan/15 bg-brand-cyan/[0.04] p-4 font-body text-[13px] leading-relaxed text-white/75">
          <li className="flex gap-2">
            <span
              aria-hidden="true"
              className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-brand-cyan"
            />
            Sign-in cu Google — fără parolă de ținut minte.
          </li>
          <li className="flex gap-2">
            <span
              aria-hidden="true"
              className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-brand-cyan"
            />
            Numele și emailul vin direct din contul tău Google.
          </li>
          <li className="flex gap-2">
            <span
              aria-hidden="true"
              className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-brand-cyan"
            />
            Pasul următor: adaugi profilul copilului și îl alegi grupa.
          </li>
        </ul>

        <p className="text-balance text-center font-body text-xs leading-relaxed text-white/45">
          Continuând, ești de acord cu condițiile academiei și cu prelucrarea
          datelor pentru contul de părinte.
        </p>
      </div>
    </AuthCardShell>
  );
}
