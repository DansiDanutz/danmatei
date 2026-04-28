/**
 * /dashboard — role router. Pulls the current user's profile and sends them
 * to the surface that matches their role:
 *
 *   owner   → /admin
 *   trainer → /antrenor
 *   parent  → first child profile (or /inregistrare/copil if none yet)
 *
 * If the role is unknown (profile not yet created) we wait briefly and
 * surface a clear "incomplete profile" hint.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import AuthCardShell from "@/components/AuthCardShell";

export default function Dashboard() {
  const { profile, loading } = useAuth();
  const [, navigate] = useLocation();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (loading) return;

    const t = setTimeout(() => setStuck(true), 4000);
    let cancelled = false;

    (async () => {
      if (!profile) return;
      if (profile.role === "owner") {
        navigate("/admin");
      } else if (profile.role === "trainer") {
        navigate("/antrenor");
      } else if (profile.role === "parent") {
        const { data, error } = await supabase
          .from("children")
          .select("id")
          .eq("parent_id", profile.id)
          .limit(1);
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          navigate("/inregistrare/copil");
        } else {
          navigate(`/copil/${data[0].id}`);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [loading, profile, navigate]);

  if (stuck) {
    return (
      <AuthCardShell
        eyebrow="Profil incomplet"
        title={
          <>
            <span className="block text-white/55">Continuă</span>
            <span className="text-gradient-cyan">configurarea</span>
          </>
        }
        subtitle="Contul tău nu are încă un rol configurat. Dacă ai venit pe link de la antrenor, finalizează invitația din email. Pentru părinți, te rugăm finalizează înscrierea copilului."
      >
        <div className="flex items-center gap-3 text-white/65">
          <Loader2 className="size-4 animate-spin text-brand-cyan" />
          <span className="font-body text-sm">Se verifică profilul…</span>
        </div>
      </AuthCardShell>
    );
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[oklch(0.08_0.02_250)]">
      <div className="flex items-center gap-3 font-heading text-[11px] uppercase tracking-[0.3em] text-brand-cyan/70">
        <Loader2 className="size-4 animate-spin" />
        Se redirecționează
      </div>
    </div>
  );
}
