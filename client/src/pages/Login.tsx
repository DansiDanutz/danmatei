/**
 * /login — single-button Google OAuth sign-in. Supabase handles the
 * round-trip to Google and back. The AuthProvider listener picks up the
 * resulting session and the route guard on /dashboard redirects by role
 * (parent → /dashboard, trainer → /antrenor, owner → /admin).
 */
import { useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import AuthCardShell from "@/components/AuthCardShell";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { useAuth } from "@/lib/auth";

export default function Login() {
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
    // Otherwise the page navigates to Google.
  };

  return (
    <AuthCardShell
      eyebrow="Cont membru"
      title={
        <>
          <span className="block text-white/55">Bine ai revenit la</span>
          <span className="text-gradient-cyan">academie</span>
        </>
      }
      subtitle="Conectează-te cu Google ca să accesezi profilul copilului, programul și mesajele de la antrenor. Folosim Google ca să nu ții minte încă o parolă."
      footer={
        <>
          Cont nou?{" "}
          <Link
            href="/inregistrare"
            className="font-heading uppercase tracking-[0.16em] text-brand-cyan hover:underline"
          >
            Înregistrează-te
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <GoogleAuthButton
          label="Conectează-te cu Google"
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

        <p className="text-balance text-center font-body text-xs leading-relaxed text-white/45">
          Continuând, ești de acord cu condițiile academiei și cu prelucrarea
          datelor pentru contul de părinte.
        </p>
      </div>
    </AuthCardShell>
  );
}
