/**
 * Cunoaste — public discovery page reached after the 5s hero timer
 * (or via the "Sări peste" skip pill). Hosts the 3-card swipe deck:
 * Owner → Trainers → Players.
 *
 * Wrapped in <PublicShell> so the same top nav (Academia, Grupe,
 * Turnee, Campionat, Știri, Notificări, Contact) renders here that
 * shows on every other public page. Previously this page had only a
 * minimal logo + Acasă button, which made it feel like a dead end.
 */
import CunoasteDeck from "@/components/cunoaste/CunoasteDeck";
import PublicShell from "@/components/PublicShell";

export default function Cunoaste() {
  return (
    // hideFooter: the deck supplies its own fixed bottom pager, so the
    // marketing footer is suppressed here to avoid stacked bottom bars.
    <PublicShell hideFooter>
      <CunoasteDeck />
    </PublicShell>
  );
}
