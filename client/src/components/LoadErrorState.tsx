/**
 * LoadErrorState — shown on public pages when the data request fails or
 * times out, so an outage never reads as "nothing published yet".
 */
import { RefreshCw, WifiOff } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function LoadErrorState({ what }: { what: string }) {
  return (
    <EmptyState
      icon={<WifiOff className="size-6" />}
      title="Nu am putut încărca datele"
      description={`Nu am putut încărca ${what}. Verifică conexiunea și încearcă din nou.`}
      action={
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-white/85 transition-colors hover:border-brand-cyan/50 hover:text-brand-cyan"
        >
          <RefreshCw className="size-3.5" />
          Reîncarcă
        </button>
      }
    />
  );
}
