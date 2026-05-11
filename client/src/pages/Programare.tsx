/**
 * /programare — public lead-capture page.
 *
 * Parents land here from a hero CTA, fill the lead form, and immediately get
 * a WhatsApp link to the AI voice agent. Transcript is later routed to the
 * trainer who handles the child's age group + the boss.
 */
import LeadForm from "@/components/leads/LeadForm";
import PublicShell from "@/components/PublicShell";

export default function Programare() {
  return (
    <PublicShell>
      <section className="relative min-h-[100dvh] py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_80%_0%,oklch(0.78_0.13_210/0.16),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(700px_400px_at_0%_30%,oklch(0.85_0.13_85/0.06),transparent_60%)]" />
        </div>

        {/* Decorative background portrait — sits on the right edge, faded
            into the page so it reads as atmosphere rather than foreground.
            Hidden below lg: the 1:1 portrait would otherwise dominate the
            tablet viewport. The mask aggressively fades the inner edge so
            only the rightmost slice shows past the centered form. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 hidden lg:block"
        >
          <img
            src="/black-white.png"
            alt=""
            className="absolute right-0 bottom-0 h-[78%] w-auto max-w-[42%] opacity-[0.09] mix-blend-screen select-none [mask-image:linear-gradient(to_left,black_25%,transparent_100%)]"
          />
        </div>

        <div className="container relative max-w-3xl">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-brand-cyan/30 text-[11px] font-heading uppercase tracking-[0.22em] text-brand-cyan">
              <span className="size-1.5 rounded-full bg-brand-cyan animate-pulse" />
              Apel direct cu un consilier
            </span>
            <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl uppercase font-bold mt-5 leading-[0.95]">
              <span className="block text-white">Înscrie-te</span>
              <span className="block text-gradient-cyan">la primul antrenament</span>
            </h1>
            <p className="mt-5 text-white/70 leading-relaxed max-w-xl mx-auto">
              Lasă-ne numărul tău. Îți trimitem pe WhatsApp un link prin care
              vorbești pe loc cu un consilier al academiei (apel direct în
              browser, fără descărcări). Antrenorul grupei copilului tău
              primește automat rezumatul.
            </p>
          </div>

          <LeadForm />

          <ul className="mt-10 grid sm:grid-cols-3 gap-3 text-center">
            <li className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
              <div className="font-heading text-2xl text-gradient-gold leading-none">
                &lt; 1 min
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/55 mt-2">
                răspuns
              </div>
            </li>
            <li className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
              <div className="font-heading text-2xl text-gradient-cyan leading-none">
                3 antrenori
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/55 mt-2">
                UEFA, pe vârste
              </div>
            </li>
            <li className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
              <div className="font-heading text-2xl text-gradient-gold leading-none">
                240+
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/55 mt-2">
                copii formați
              </div>
            </li>
          </ul>
        </div>
      </section>
    </PublicShell>
  );
}
