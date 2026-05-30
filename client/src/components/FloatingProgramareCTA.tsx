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
      aria-label="Programează o discuție"
      className={`fixed right-3 z-[60] box-border inline-flex min-h-[48px] min-w-[10.75rem] max-w-[calc(100vw-1.5rem)] items-center justify-center gap-2.5 rounded-full bg-brand-cyan px-5 py-3 text-center font-heading text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-[oklch(0.08_0.02_250)] shadow-[0_0_0_1px_oklch(0.78_0.13_210/0.7),0_18px_40px_-10px_oklch(0.78_0.13_210/0.55),0_0_60px_-15px_oklch(0.78_0.13_210/0.6)] transition-all duration-300 sm:right-6 sm:min-w-[11.5rem] sm:px-6 sm:text-xs sm:tracking-[0.1em] ${
        onCunoaste ? "bottom-28 lg:bottom-24" : "bottom-20 sm:bottom-6"
      } ${
        show
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none"
      } hover:-translate-y-0.5 hover:scale-[1.03]`}
    >
      <PhoneCall className="size-4 shrink-0" />
      <span className="shrink-0 whitespace-nowrap text-center">
        Programează
      </span>
    </a>
  );
}
