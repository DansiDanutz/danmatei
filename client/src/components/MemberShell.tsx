/**
 * MemberShell — top chrome shared by all auth-gated routes (parent /copil,
 * trainer /antrenor, owner /admin). Header has the brand mark, the
 * current user's name + role pill, and a sign-out control. Below: the
 * route's content. Cyan-anchored to match the public site.
 */
import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home as HomeIcon, LogOut } from "lucide-react";
import { useAuth, type UserRole } from "@/lib/auth";
import NotificationBell from "@/components/notifications/NotificationBell";

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Proprietar",
  super_admin: "Admin",
  trainer: "Antrenor",
  parent: "Părinte",
};

type Props = {
  children: ReactNode;
  navLinks?: { href: string; label: string }[];
};

export default function MemberShell({ children, navLinks }: Props) {
  const { profile, signOut } = useAuth();
  const [location] = useLocation();

  return (
    <div className="relative min-h-[100dvh] bg-[oklch(0.08_0.02_250)] text-white">
      {/* Atmosphere */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 top-1/4 size-[36rem] rounded-full bg-brand-cyan/[0.06] blur-3xl" />
        <div className="absolute -right-32 bottom-1/4 size-[32rem] rounded-full bg-brand-cyan/[0.04] blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[oklch(0.08_0.02_250)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-3"
            aria-label="Dashboard"
          >
            <span className="grid size-9 place-items-center rounded-full ring-1 ring-brand-cyan/30 shadow-[0_0_24px_-6px_oklch(0.75_0.12_230/0.45)] transition-transform group-hover:scale-105">
              <img
                src="/logo-official.jpg"
                alt=""
                width={28}
                height={28}
                className="size-7 rounded-full"
              />
            </span>
            <span className="hidden font-heading text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85 sm:inline">
              Școala Dan Matei
            </span>
          </Link>

          {navLinks && navLinks.length > 0 && (
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map(l => {
                const active =
                  location === l.href || location.startsWith(l.href + "/");
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`touch-target rounded-full px-3.5 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] transition-colors ${
                      active
                        ? "bg-brand-cyan/15 text-brand-cyan ring-1 ring-brand-cyan/40"
                        : "text-white/65 hover:text-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {profile && (
              <div className="hidden flex-col items-end leading-none sm:flex">
                <span className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
                  {profile.full_name}
                </span>
                <span className="mt-0.5 font-heading text-[9px] uppercase tracking-[0.22em] text-brand-cyan/80">
                  {ROLE_LABEL[profile.role]}
                </span>
              </div>
            )}

            {profile && <NotificationBell />}

            <Link
              href="/"
              aria-label="Acasă"
              className="touch-target hidden size-9 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/70 transition-colors hover:border-brand-cyan/40 hover:text-white sm:grid"
            >
              <HomeIcon className="size-4" />
            </Link>

            <button
              type="button"
              onClick={signOut}
              aria-label="Deconectează-te"
              className="touch-target inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 font-heading text-[10px] font-medium uppercase tracking-[0.18em] text-white/70 transition-colors hover:border-rose-300/40 hover:text-rose-200"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Ieși</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        {children}
      </main>
    </div>
  );
}
