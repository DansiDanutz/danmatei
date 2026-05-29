/**
 * UpdatePrompt — a slim top-center banner that appears when a newer build has
 * shipped (see useAppUpdate). "Actualizează" reloads into the new version;
 * the user can also dismiss it. Mounted once at the app root.
 *
 * Top-center is deliberate: it never collides with the bottom chrome (the
 * /cunoaste deck pager + the floating "Programează" CTA both live at the
 * bottom).
 */
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { useAppUpdate } from "@/lib/use-app-update";

export default function UpdatePrompt() {
  const { updateReady, applyUpdate, dismiss } = useAppUpdate();

  return (
    <AnimatePresence>
      {updateReady && (
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] flex justify-center px-4"
        >
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-brand-cyan/30 bg-[oklch(0.12_0.02_250)]/90 py-2 pl-4 pr-2 shadow-[0_18px_50px_-18px_oklch(0.75_0.12_230/0.6)] backdrop-blur-xl">
            <RefreshCw
              className="size-4 shrink-0 text-brand-cyan"
              aria-hidden="true"
            />
            <span className="font-heading text-[12px] font-medium uppercase tracking-[0.12em] text-white/85">
              Versiune nouă disponibilă
            </span>
            <button
              type="button"
              onClick={applyUpdate}
              className="touch-target inline-flex items-center rounded-full bg-brand-cyan px-4 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[oklch(0.08_0.02_250)] transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              Actualizează
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Închide"
              className="touch-target grid size-8 place-items-center rounded-full text-white/50 transition-colors hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
