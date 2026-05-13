/**
 * InstallAppButton — red CTA shown to every logged-in user that turns the
 * site into a phone app via the PWA install prompt.
 *
 * Detect-already-installed strategy (three signals, any of them hides the
 * button — none of them lies):
 *   1. `display-mode: standalone` (or iOS `navigator.standalone`). Covers
 *      "user opened the app from the installed icon".
 *   2. A `localStorage` flag we set on the `appinstalled` event. Covers
 *      "user installed at some point on this browser, now visits the site
 *      via a regular tab". The flag is cleared when `beforeinstallprompt`
 *      fires again — that's the browser telling us the PWA is *not*
 *      installed (e.g. user uninstalled it).
 *   3. `navigator.getInstalledRelatedApps()` on Chromium-based browsers.
 *      Authoritative answer to "is the PWA installed on this device?".
 *      Requires manifest `related_applications` self-reference (added).
 *
 * Click behavior:
 * - Chromium / Edge / Android Chrome: captures `beforeinstallprompt` and
 *   calls `prompt()`. After install the OS adds an icon to the
 *   home-screen and the saved Supabase session (localStorage) means the
 *   user is already logged in on next launch.
 * - iOS Safari (no programmatic install): opens a Romanian
 *   "Adaugă pe ecran" tutorial pointing at Safari's Share menu.
 */
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Plus, Share, Smartphone, X } from "lucide-react";
import { useAuth } from "@/lib/auth";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; url?: string; id?: string }>>;
};

const INSTALL_FLAG_KEY = "dm-pwa-installed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari exposes a non-standard flag when running from home-screen.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function readInstallFlag(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function writeInstallFlag(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(INSTALL_FLAG_KEY, "1");
    else window.localStorage.removeItem(INSTALL_FLAG_KEY);
  } catch {
    /* private mode / storage disabled — silently ignore */
  }
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || "";
  return /iphone|ipad|ipod/i.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export default function InstallAppButton() {
  const { profile } = useAuth();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone() || readInstallFlag());
  const [showGuide, setShowGuide] = useState(false);

  // One-shot probe against `navigator.getInstalledRelatedApps()` so a user
  // who installed on another browser session still sees the button hide
  // when they come back to a regular tab.
  useEffect(() => {
    if (installed) return;
    const nav = navigator as NavigatorWithRelatedApps;
    if (typeof nav.getInstalledRelatedApps !== "function") return;
    let cancelled = false;
    nav.getInstalledRelatedApps()
      .then((apps) => {
        if (cancelled) return;
        if (apps.length > 0) {
          writeInstallFlag(true);
          setInstalled(true);
        }
      })
      .catch(() => { /* unsupported / not allowed — ignore */ });
    return () => {
      cancelled = true;
    };
  }, [installed]);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      // The browser would only fire this if the PWA is NOT currently
      // installed — clear any stale flag from a previous uninstall.
      if (readInstallFlag()) {
        writeInstallFlag(false);
        setInstalled(false);
      }
    };
    const onAppInstalled = () => {
      writeInstallFlag(true);
      setInstalled(true);
      setInstallEvent(null);
      setShowGuide(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // Spec: only visible to authenticated users. If auth isn't loaded yet or
  // the user is anonymous, render nothing.
  if (!profile) return null;
  if (installed) return null;

  const handleClick = async () => {
    if (installEvent) {
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === "accepted") {
          writeInstallFlag(true);
          setInstalled(true);
          setInstallEvent(null);
        }
      } catch (err) {
        console.warn("Install prompt failed:", err);
        setShowGuide(true);
      }
      return;
    }
    // No native prompt (iOS Safari, Firefox desktop, some Android browsers).
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Instalează aplicația mobilă pe telefon"
        className="touch-target inline-flex items-center gap-2 rounded-full bg-rose-500 px-3 py-2 font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_8px_24px_-8px_rgba(244,63,94,0.65)] transition hover:bg-rose-400 hover:shadow-[0_12px_30px_-8px_rgba(244,63,94,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70"
      >
        <Download className="size-3.5" />
        <span className="hidden sm:inline">Instalează app</span>
      </button>

      <AnimatePresence>
        {showGuide && (
          <InstallGuideModal
            ios={isIOS()}
            onClose={() => setShowGuide(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function InstallGuideModal({
  ios,
  onClose,
}: {
  ios: boolean;
  onClose: () => void;
}) {
  const steps: Array<{ icon: ReactNode; title: string; body: string }> = ios
    ? [
        {
          icon: <Share className="size-5" />,
          title: "Apasă pictograma Share",
          body: "Sus de tot, în Safari. Este pătratul cu săgeată în sus.",
        },
        {
          icon: <Plus className="size-5" />,
          title: "Alege „Adaugă pe ecran”",
          body: "Derulează puțin în jos în meniul Share — opțiunea apare după Marcaje și Trimite.",
        },
        {
          icon: <Smartphone className="size-5" />,
          title: "Confirmă cu „Adaugă”",
          body: "Aplicația apare pe ecranul telefonului și te conectează automat la contul tău de fiecare dată.",
        },
      ]
    : [
        {
          icon: <Smartphone className="size-5" />,
          title: "Deschide meniul browserului",
          body: "În Chrome sau Edge, apasă pictograma cu trei puncte (sus dreapta pe mobil, sus dreapta pe desktop).",
        },
        {
          icon: <Plus className="size-5" />,
          title: "Alege „Instalează aplicația”",
          body: "Sau „Adaugă pe ecranul principal”. Numele exact depinde de browser.",
        },
        {
          icon: <Download className="size-5" />,
          title: "Apasă „Instalează”",
          body: "Aplicația apare ca pictogramă pe telefon și te conectează automat la contul tău de fiecare dată.",
        },
      ];

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-guide-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-4 pb-6 pt-12 sm:items-center sm:p-6 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.10_0.02_250)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:border-white/30 hover:text-white"
        >
          <X className="size-4" />
        </button>

        <div className="border-b border-white/8 px-6 pb-4 pt-6">
          <span className="font-heading text-[10px] uppercase tracking-[0.22em] text-rose-300/80">
            Instalează aplicația
          </span>
          <h2
            id="install-guide-title"
            className="mt-2 font-heading text-xl font-bold text-white"
          >
            {ios ? "Pe iPhone / iPad" : "Pe telefonul tău"}
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-white/65">
            După instalare, deschizi aplicația direct de pe ecran, fără să mai introduci email și parolă.
          </p>
        </div>

        <ol className="space-y-4 px-6 py-5">
          {steps.map((step, idx) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-rose-300/30 bg-rose-500/10 text-rose-300">
                {step.icon}
              </span>
              <div className="min-w-0">
                <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-rose-300/70">
                  Pasul {idx + 1}
                </p>
                <p className="mt-1 font-heading text-sm font-semibold text-white">
                  {step.title}
                </p>
                <p className="mt-1 font-body text-xs leading-relaxed text-white/60">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="border-t border-white/8 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-rose-500 px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-[0_8px_22px_-8px_rgba(244,63,94,0.6)] transition hover:bg-rose-400"
          >
            Am înțeles
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
