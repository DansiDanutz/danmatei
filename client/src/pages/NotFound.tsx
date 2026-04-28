import { Link } from "wouter";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[oklch(0.08_0.02_250)] px-4">
      <div className="text-center">
        <h1 className="font-heading text-7xl font-bold uppercase tracking-[0.04em] text-brand-cyan sm:text-9xl">
          404
        </h1>
        <p className="mt-4 font-heading text-lg uppercase tracking-[0.12em] text-white/85">
          Pagina nu a fost găsită
        </p>
        <p className="mx-auto mt-2 max-w-md font-body text-sm leading-relaxed text-white/50">
          Linkul pe care l-ai accesat nu există sau a fost mutat.
        </p>
        <Link
          href="/"
          className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-brand-cyan px-6 py-3 font-heading text-sm font-semibold uppercase tracking-[0.16em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)]"
        >
          <Home className="size-4" />
          Înapoi acasă
        </Link>
      </div>
    </div>
  );
}
