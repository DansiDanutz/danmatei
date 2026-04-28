/**
 * Route guards used inside Wouter <Route> components.
 *
 *   <RequireAuth>...</RequireAuth>          — must be logged in
 *   <RequireRole roles={['owner']}>...</>   — must have one of the listed roles
 *   <PublicOnly>...</PublicOnly>            — kicks logged-in users to /dashboard
 *
 * All three render a tiny cyan loading state while the auth context is
 * still rehydrating from localStorage so we don't flash the wrong UI.
 */
import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth, type UserRole } from "@/lib/auth";

function LoadingShell() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[oklch(0.08_0.02_250)]">
      <div className="flex items-center gap-3 font-heading text-[11px] uppercase tracking-[0.3em] text-brand-cyan/70">
        <span className="block size-1.5 animate-pulse rounded-full bg-brand-cyan" />
        Se încarcă
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  if (loading || !user) return <LoadingShell />;
  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const { loading, user, profile } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
    } else if (profile && !roles.includes(profile.role)) {
      navigate("/dashboard");
    }
  }, [loading, user, profile, roles, navigate]);

  if (loading || !user || !profile) return <LoadingShell />;
  if (!roles.includes(profile.role)) return <LoadingShell />;
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      // Use native navigation as a reliable fallback when wouter's
      // client-side navigate doesn't trigger from inside a guard that
      // returns early (e.g. LoadingShell).
      navigate("/dashboard");
      // Fallback: if wouter doesn't re-route within 100ms, force reload.
      const t = setTimeout(() => {
        if (window.location.pathname === "/login" || window.location.pathname === "/inregistrare") {
          window.location.replace("/dashboard");
        }
      }, 150);
      return () => clearTimeout(t);
    }
  }, [loading, user, navigate]);

  if (loading) return <LoadingShell />;
  if (user) return <LoadingShell />;
  return <>{children}</>;
}
