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

const HIDDEN_ROUTES = [/^\/apel/, /^\/login/, /^\/inregistrare/, /^\/programare/];

export default function FloatingProgramareCTA() {
  const [location] = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (HIDDEN_ROUTES.some((re) => re.test(location))) return null;

  return (
    <a
      href="/programare"
      aria-label="Vorbește cu un consilier acum"
      className={`fixed z-[60] bottom-20 right-4 sm:bottom-6 sm:right-6 inline-flex items-center gap-2.5 rounded-full bg-brand-cyan text-[oklch(0.08_0.02_250)] font-heading uppercase tracking-[0.16em] text-[11px] sm:text-xs px-4 py-3 sm:px-5 sm:py-3.5 shadow-[0_0_0_1px_oklch(0.78_0.13_210/0.7),0_18px_40px_-10px_oklch(0.78_0.13_210/0.55),0_0_60px_-15px_oklch(0.78_0.13_210/0.6)] transition-all duration-300 ${
        show
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none"
      } hover:-translate-y-0.5 hover:scale-[1.03]`}
    >
      <span
        aria-hidden="true"
        className="size-2 rounded-full bg-[oklch(0.08_0.02_250)] animate-pulse"
      />
      <PhoneCall className="size-4" />
      <span>Programare</span>
    </a>
  );
}
