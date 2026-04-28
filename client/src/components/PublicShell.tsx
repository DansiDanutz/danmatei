/**
 * PublicShell — shared layout for the new public marketing pages
 * (Academie, Grupe, Turnee, Campionat, Stiri). Includes the new top
 * nav (mobile drawer + desktop horizontal), an optional page header
 * block, and a footer.
 *
 * Public pages all share this shell so the brand chrome is consistent
 * and the menu's active state propagates wherever the user lands.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Trophy,
  Users,
  Newspaper,
  Bell,
  GraduationCap,
  ListOrdered,
  Phone,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { expoOut } from "@/lib/motion";

export interface PublicShellProps {
  children: ReactNode;
  pageTitle?: string;
  pageKicker?: string;
  pageDescription?: string;
}

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/academie", label: "Academia", icon: <GraduationCap className="size-4" /> },
  { href: "/grupe", label: "Grupe", icon: <Users className="size-4" /> },
  { href: "/turnee", label: "Turnee", icon: <Trophy className="size-4" /> },
  { href: "/campionat", label: "Campionat", icon: <ListOrdered className="size-4" /> },
  { href: "/stiri", label: "Știri", icon: <Newspaper className="size-4" /> },
  { href: "/notificari", label: "Notificări", icon: <Bell className="size-4" /> },
];

export default function PublicShell({
  children,
  pageTitle,
  pageKicker,
  pageDescription,
}: PublicShellProps) {
  const { profile } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="relative min-h-[100dvh] bg-[oklch(0.08_0.02_250)] text-white">
      {/* Background atmosphere */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/3 size-[40rem] rounded-full bg-brand-cyan/[0.07] blur-3xl" />
        <div className="absolute -right-40 bottom-1/4 size-[36rem] rounded-full bg-brand-cyan/[0.04] blur-3xl" />
        <div className="absolute left-1/2 top-0 h-px w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-cyan/30 to-transparent" />
      </div>

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled || mobileOpen
            ? "border-b border-white/5 bg-[oklch(0.08_0.02_250/0.95)] backdrop-blur-xl"
            : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-8">
          <Link
            href="/"
            className="group flex items-center gap-3"
            aria-label="Acasă"
          >
            <span className="grid size-10 place-items-center rounded-full bg-white shadow-[0_0_24px_-6px_oklch(0.75_0.12_230/0.5)] ring-1 ring-brand-cyan/30 transition-transform group-hover:scale-105">
              <img
                src="/logo-official.jpg"
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-full"
              />
            </span>
            <div className="hidden flex-col leading-none sm:flex">
              <span className="font-heading text-base font-bold uppercase tracking-wider text-white">
                Dan Matei
              </span>
              <span className="font-heading text-[10px] uppercase tracking-[0.22em] text-brand-cyan">
                Școala de Fotbal
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-heading text-[11px] uppercase tracking-[0.16em] transition-colors ${
                    active
                      ? "text-brand-cyan"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-0 -z-10 rounded-full border border-brand-cyan/30 bg-brand-cyan/10"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href={profile ? "/dashboard" : "/login"}
              className="hidden items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/20 sm:inline-flex"
            >
              {profile ? "Dashboard" : "Cont"}
              <ArrowUpRight className="size-3.5" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/85 transition-colors hover:border-brand-cyan/40 lg:hidden"
              aria-label={mobileOpen ? "Închide meniul" : "Deschide meniul"}
              aria-expanded={mobileOpen}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <motion.span
                    key="x"
                    initial={{ rotate: -45, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 45, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <X className="size-5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="m"
                    initial={{ rotate: 45, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -45, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Menu className="size-5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-[oklch(0.08_0.02_250/0.98)] pt-20 backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto flex h-full max-w-md flex-col px-5 py-6">
              <div className="flex-1 space-y-1">
                {NAV_ITEMS.map((item, i) => {
                  const active = location === item.href;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease: expoOut }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-4 transition-colors ${
                          active
                            ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
                            : "border-white/8 bg-white/[0.03] text-white/80 hover:border-brand-cyan/30 hover:text-white"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-full bg-white/5">
                            {item.icon}
                          </span>
                          <span className="font-heading text-base uppercase tracking-[0.12em]">
                            {item.label}
                          </span>
                        </span>
                        <span className="font-heading text-[10px] tabular-nums text-white/40">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center gap-2 border-t border-white/5 pt-5">
                <Link
                  href={profile ? "/dashboard" : "/login"}
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 rounded-full bg-brand-cyan py-3 text-center font-heading text-sm font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)]"
                >
                  {profile ? "Dashboard" : "Intră în cont"}
                </Link>
                <a
                  href="tel:0744311147"
                  className="grid size-12 place-items-center rounded-full border border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
                  aria-label="Sună"
                >
                  <Phone className="size-5" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 pt-16 sm:pt-20">
        {(pageTitle ?? pageKicker ?? pageDescription) && (
          <section className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-8 sm:pb-10 sm:pt-16">
            {pageKicker && (
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: expoOut }}
                className="inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1 font-heading text-[10px] uppercase tracking-[0.22em] text-brand-cyan"
              >
                <span className="size-1.5 rounded-full bg-brand-cyan" />
                {pageKicker}
              </motion.span>
            )}
            {pageTitle && (
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: expoOut }}
                className="mt-3 font-heading text-3xl font-bold uppercase leading-[1.05] tracking-[0.02em] text-white sm:text-5xl"
              >
                {pageTitle}
              </motion.h1>
            )}
            {pageDescription && (
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: expoOut }}
                className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-white/60 sm:text-base"
              >
                {pageDescription}
              </motion.p>
            )}
          </section>
        )}

        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">{children}</div>
      </main>

      <footer className="relative z-10 mt-12 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-white">
              <img
                src="/logo-official.jpg"
                alt=""
                width={28}
                height={28}
                className="size-7 rounded-full"
              />
            </span>
            <div>
              <p className="font-heading text-sm font-semibold uppercase tracking-wider text-white">
                Școala de Fotbal Dan Matei
              </p>
              <p className="font-body text-xs text-white/45">
                Cluj-Napoca · Licență UEFA · Din 2017
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <a
              href="tel:0744311147"
              className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 transition-colors hover:border-brand-cyan/40 hover:text-white"
            >
              <Phone className="size-3.5" />
              0744 311 147
            </a>
            <span>© {new Date().getFullYear()} ACS Dan Matei</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
