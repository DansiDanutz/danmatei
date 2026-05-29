/**
 * /seteaza-parola — where an invited trainer (or anyone using "forgot
 * password") sets their account password.
 *
 * Flow: the Supabase invite / recovery email link verifies a one-time token
 * and redirects here with a session in the URL (the client has
 * `detectSessionInUrl: true`, so supabase-js establishes the session on load
 * and AuthProvider picks it up). With that session we call
 * `supabase.auth.updateUser({ password })`, then route the user to /dashboard
 * (the role router sends a trainer on to /antrenor).
 *
 * No route guard: the invited user IS authenticated via the invite session,
 * so a PublicOnly/RequireAuth guard would either bounce them or block the
 * expired-link messaging. The page handles every state itself.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AuthCardShell from "@/components/AuthCardShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const MIN_LEN = 8;
const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-3 pr-11 font-body text-base text-white placeholder:text-white/25 outline-none focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/20";

/**
 * Supabase's implicit flow returns auth errors (expired/used link) in the URL
 * hash or query. Read them once on mount so we can show a clear message
 * instead of an empty form the user can't submit.
 */
function readLinkError(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash || window.location.search.replace(/^\?/, ""));
  const raw = params.get("error_description") || params.get("error");
  if (!raw) return null;
  const msg = decodeURIComponent(raw.replace(/\+/g, " "));
  if (/expired|invalid|otp/i.test(msg)) {
    return "Linkul a expirat sau a fost deja folosit. Cere administratorului o invitație nouă.";
  }
  return msg;
}

export default function SeteazaParola() {
  const { session, loading } = useAuth();
  const [, navigate] = useLocation();

  const [linkError] = useState<string | null>(() => readLinkError());
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // The invite/recovery session is established asynchronously from the URL.
  // Give it a few seconds before deciding the link is invalid.
  const [graceElapsed, setGraceElapsed] = useState(false);

  // We're on the set-password page now — clear the invite/recovery flag so the
  // App-level safety net (PasswordSetupRedirect) doesn't try to redirect again.
  useEffect(() => {
    try {
      sessionStorage.removeItem("pw-setup-pending");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (session || linkError) return;
    const t = setTimeout(() => setGraceElapsed(true), 4000);
    return () => clearTimeout(t);
  }, [session, linkError]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LEN) {
      setError(`Parola trebuie să aibă cel puțin ${MIN_LEN} caractere.`);
      return;
    }
    if (password !== confirm) {
      setError("Parolele nu coincid.");
      return;
    }
    setSubmitting(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    if (upErr) {
      setError(upErr.message);
      setSubmitting(false);
      return;
    }
    setDone(true);
    toast.success("Parola a fost setată. Bun venit în echipă!");
    setTimeout(() => navigate("/dashboard"), 1200);
  };

  // ── Success ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <AuthCardShell
        eyebrow="Cont antrenor"
        title={
          <>
            <span className="block text-white/55">Parolă</span>
            <span className="text-gradient-cyan">setată</span>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <ShieldCheck className="size-8 text-brand-cyan" />
          <p className="font-body text-sm text-white/70">
            Te conectăm la contul tău…
          </p>
          <Loader2 className="size-4 animate-spin text-brand-cyan" />
        </div>
      </AuthCardShell>
    );
  }

  // ── Bad / expired link ─────────────────────────────────────────────────────
  if (linkError || (!session && graceElapsed)) {
    return (
      <AuthCardShell
        eyebrow="Link invitație"
        title={
          <>
            <span className="block text-white/55">Link</span>
            <span className="text-gradient-cyan">indisponibil</span>
          </>
        }
        subtitle="Nu am putut confirma invitația din acest link."
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
            {linkError ?? "Linkul de invitație este invalid sau a expirat."}
          </p>
          <p className="font-body text-sm text-white/60">
            Cere administratorului să retrimită invitația. Dacă ai deja un cont,
            poți să te conectezi direct.
          </p>
          <Link
            href="/login"
            className="touch-target inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-brand-cyan px-5 py-3 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)]"
          >
            Mergi la conectare
          </Link>
        </div>
      </AuthCardShell>
    );
  }

  // ── Waiting for the invite/recovery session to come up ─────────────────────
  if (!session) {
    return (
      <AuthCardShell eyebrow="Cont antrenor" title="Verificăm linkul…">
        <div className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-brand-cyan" />
        </div>
      </AuthCardShell>
    );
  }

  // ── Set-password form ──────────────────────────────────────────────────────
  return (
    <AuthCardShell
      eyebrow="Cont antrenor"
      title={
        <>
          <span className="block text-white/55">Setează-ți</span>
          <span className="text-gradient-cyan">parola</span>
        </>
      }
      subtitle={`Alege o parolă de cel puțin ${MIN_LEN} caractere pentru ${
        session.user.email ?? "contul tău"
      }.`}
      footer={
        <>
          Ai deja parolă?{" "}
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center px-1 py-2 font-heading uppercase tracking-[0.16em] text-brand-cyan hover:underline"
          >
            Conectează-te
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Parolă nouă"
            autoComplete="new-password"
            aria-label="Parolă nouă"
            className={INPUT_CLS}
            required
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            aria-label={show ? "Ascunde parola" : "Arată parola"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        <input
          type={show ? "text" : "password"}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Confirmă parola"
          autoComplete="new-password"
          aria-label="Confirmă parola"
          className={INPUT_CLS}
          required
        />

        {error && (
          <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="touch-target inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-brand-cyan px-5 py-3 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Salvează parola"
          )}
        </button>
      </form>
    </AuthCardShell>
  );
}
