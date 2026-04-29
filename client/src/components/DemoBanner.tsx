/**
 * DemoBanner — shown on public pages that are currently displaying
 * fallback/demo data because the database table is empty.
 */
import { Info } from "lucide-react";

export default function DemoBanner() {
  return (
    <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-brand-gold/20 bg-brand-gold/10 px-4 py-3">
      <Info className="size-3.5 shrink-0 text-brand-gold" />
      <p className="font-heading text-[11px] uppercase tracking-[0.16em] text-brand-gold">
        Date de demonstrație — conținutul real va fi afișat după ce adminul adaugă date.
      </p>
    </div>
  );
}
