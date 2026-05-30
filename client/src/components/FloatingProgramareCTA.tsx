/**
 * FloatingProgramareCTA — sticky bottom-right pill that opens the
 * /programare lead form after visitors have had time to read the page.
 *
 * Hidden on auth pages (avoid distraction during sign-up). Fades in after
 * the visitor scrolls past 600px so the hero stays clean.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { PhoneCall } from "lucide-react";

const HIDDEN_ROUTES = [
  /^\/apel/,
  /^\/login/,
  /^\/inregistrare/,
  /^\/programare/,
];

export default function FloatingProgramareCTA() {
  const [location] = useLocation();
  const [show, setShow] = useState(false);
  const onCunoaste = /^\/cunoaste/.test(location);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (HIDDEN_ROUTES.some(re => re.test(location))) return null;

  return (
    <a
      href="/programare"
      aria-label="Vorbește cu un consilier acum"
      className={`fixed right-4 z-[60] inline-flex min-h-[44px] max-w-[calc(100vw-2rem)] min-w-0 items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-3 text-center font-heading text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-[oklch(0.08_0.02_250)] shadow-[0_0_0_1px_oklch(0.78_0.13_210/0.7),0_18px_40px_-10px_oklch(0.78_0.13_210/0.55),0_0_60px_-15px_oklch(0.78_0.13_210/0.6)] transition-all duration-300 sm:right-6 sm:max-w-[calc(100vw-3rem)] sm:px-5 sm:py-3.5 sm:text-xs sm:tracking-[0.14em] ${
        onCunoaste ? "bottom-28 lg:bottom-24" : "bottom-20 sm:bottom-6"
      } ${
        show
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none"
      } hover:-translate-y-0.5 hover:scale-[1.03]`}
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full bg-[oklch(0.08_0.02_250)] animate-pulse"
      />
      <PhoneCall className="size-4 shrink-0" />
      <span className="min-w-0 whitespace-nowrap">Programare</span>
    </a>
  );
}
