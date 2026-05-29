/**
 * Info popover that explains the academy's 4-color (+ closed) payment status
 * system. Reused from both the parent's "Plăți" tab and the admin's payments
 * dashboard. Triggered by a small round info button so it doesn't take any
 * visual room next to the badge.
 *
 * Wording references the 15th-of-month cutoff because that's the contractual
 * due date emitted by the monthly-charges cron — parents and admins should
 * see the same explanation everywhere.
 */
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

export function PaymentStatusInfo() {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label="Explică sistemul de status al plăților"
        className="inline-flex size-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/65 transition-colors hover:text-white"
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border-white/10 bg-[oklch(0.10_0.02_250)] p-4 text-sm leading-relaxed text-white/80"
      >
        <p className="font-heading text-[11px] uppercase tracking-[0.18em] text-white/55 mb-3">
          Cum funcționează statusul plății
        </p>
        <ul className="space-y-2">
          <li>
            <span className="inline-block size-2 rounded-full bg-emerald-300 mr-2 align-middle" />
            <strong>La zi</strong> — Plată făcută până pe data de 15 a lunii.
          </li>
          <li>
            <span className="inline-block size-2 rounded-full bg-amber-300 mr-2 align-middle" />
            <strong>1 lună restanță</strong> — Data de 15 a trecut fără plată.
          </li>
          <li>
            <span className="inline-block size-2 rounded-full bg-orange-400 mr-2 align-middle" />
            <strong>2 luni restanță</strong> — Al doilea termen a trecut fără
            plată.
          </li>
          <li>
            <span className="inline-block size-2 rounded-full bg-rose-400 mr-2 align-middle" />
            <strong>3 luni restanță</strong> — Al treilea termen a trecut. După
            aceea contul se închide automat.
          </li>
          <li>
            <span className="inline-block size-2 rounded-full bg-white/40 mr-2 align-middle" />
            <strong>Cont închis</strong> — Peste 3 luni restanță. Contactați
            academia pentru reactivare.
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
