/**
 * /login — single-button Google OAuth sign-in. Supabase handles the
 * round-trip to Google and back. The AuthProvider listener picks up the
 * resulting session and the route guard on /dashboard redirects by role
 * (parent → /dashboard, trainer → /antrenor, owner → /admin).
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import AuthCardShell from "@/components/AuthCardShell";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { signInWithGoogle, signIn } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  // Email/password test form (hidden unless ?email=1 is present)
  const showEmailForm = new URLSearchParams(window.location.search).get("email") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // If redirect doesn't happen within 4s, show a fallback direct link.
  useEffect(() => {
    if (!submitting) return;
    const t = setTimeout(() => setShowFallback(true), 4000);
    return () => clearTimeout(t);
  }, [submitting]);

  const handleGoogle = async (): Promise<void> => {
    setServerError(null);
    setShowFallback(false);
    setSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setServerError(error);
        setSubmitting(false);
      }
      // Otherwise the browser navigates away to Google.
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Eroare la conectare");
      setSubmitting(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setEmailSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      setServerError(error);
      setEmailSubmitting(false);
    }
    // Successful login triggers onAuthStateChange → redirect handled by App/RouteGuards
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

        {showEmailForm && (
          <form onSubmit={handleEmail} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-center font-body text-xs text-white/55">Test login (email + parolă)</p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder-white/30 outline-none focus:border-brand-cyan/50"
              required
            />
            <input
              type="password"
              placeholder="Parolă"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder-white/30 outline-none focus:border-brand-cyan/50"
              required
            />
            <button
              type="submit"
              disabled={emailSubmitting}
              className="rounded-full border border-brand-cyan/40 bg-[oklch(0.10_0.02_250)] px-4 py-2 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:border-brand-cyan/70 disabled:opacity-60"
            >
              {emailSubmitting ? <Loader2 className="mx-auto size-3 animate-spin" /> : "Conectează-te"}
            </button>
          </form>
        )}

        {serverError && (
          <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
            {serverError}
          </p>
        )}

        {submitting && !serverError && !showFallback && (
          <p className="inline-flex items-center justify-center gap-2 font-body text-xs text-white/55">
            <Loader2 className="size-3 animate-spin" />
            Așteaptă redirecționarea…
          </p>
        )}

        {showFallback && !serverError && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-3">
            <p className="text-center font-body text-xs text-brand-cyan">
              Redirecționarea este blocată de browser.
            </p>
            <a
              href={`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${window.location.origin}/dashboard`)}&prompt=select_account`}
              className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-white underline underline-offset-2 hover:text-brand-cyan"
            >
              Apasă aici pentru conectare directă
            </a>
          </div>
        )}

        <p className="text-balance text-center font-body text-xs leading-relaxed text-white/45">
          Continuând, ești de acord cu condițiile academiei și cu prelucrarea
          datelor pentru contul de părinte.
        </p>
      </div>
    </AuthCardShell>
  );
}
