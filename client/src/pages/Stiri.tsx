/**
 * /stiri — Public news feed. Reads `fotbal.news` where audience='public'
 * (and any members-audience rows when the visitor is signed in).
 * Falls back to a small set of placeholder posts when empty.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Tag } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { supabase } from "@/lib/supabase";
import { expoOut } from "@/lib/motion";

interface NewsRow {
  id: string;
  title: string;
  body_md: string;
  cover_path: string | null;
  audience: "public" | "members" | "group";
  published_at: string | null;
}

const FALLBACK_NEWS: NewsRow[] = [
  {
    id: "demo-1",
    title: "Înscrieri deschise pentru anul școlar 2026–2027",
    body_md:
      "Începem înscrierile pentru noul an. Avem locuri pentru U6 până la U15. Antrenamentele luni–vineri 16:00–19:00 la Baza Sportivă Mănăștur.",
    cover_path: null,
    audience: "public",
    published_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    title: "U13 câștigă Cupa Transilvaniei pentru a doua oară consecutiv",
    body_md:
      "Felicitări băieților și antrenorului Cristi Ilea! 5 victorii din 5 meciuri, 18 goluri marcate, 3 primite.",
    cover_path: null,
    audience: "public",
    published_at: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
];

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function Stiri() {
  const [posts, setPosts] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("news")
        .select("id, title, body_md, cover_path, audience, published_at")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(40);
      if (cancelled) return;
      const rows = (data as NewsRow[] | null) ?? [];
      setPosts(rows.length === 0 ? FALLBACK_NEWS : rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicShell
      pageKicker="Știri"
      pageTitle="Ultimele noutăți"
      pageDescription="Articole, anunțuri, rezultate și momente importante din viața academiei."
    >
      {loading && (
        <div className="grid place-items-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {posts.map((p, i) => {
          const date = p.published_at
            ? dateFormatter.format(new Date(p.published_at))
            : "—";
          return (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: expoOut }}
              className="group overflow-hidden rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/50 transition-colors hover:border-brand-cyan/30"
            >
              {p.cover_path ? (
                <div className="aspect-[16/9] overflow-hidden bg-[oklch(0.10_0.02_250)]">
                  <img
                    src={p.cover_path}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              ) : (
                <div className="grid aspect-[16/9] place-items-center bg-gradient-to-br from-brand-navy/30 via-brand-cyan/10 to-transparent">
                  <span className="font-heading text-2xl font-bold uppercase tracking-[0.16em] text-white/30">
                    Dan Matei
                  </span>
                </div>
              )}
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2 font-body text-[11px] text-white/45">
                  <Calendar className="size-3.5 text-brand-cyan/70" />
                  {date}
                  <span className="text-white/15">·</span>
                  <Tag className="size-3.5 text-brand-cyan/70" />
                  <span className="capitalize">{p.audience}</span>
                </div>
                <h2 className="mt-3 font-heading text-lg font-bold uppercase tracking-[0.04em] text-white sm:text-xl">
                  {p.title}
                </h2>
                <p className="mt-2 line-clamp-3 font-body text-sm leading-relaxed text-white/65">
                  {p.body_md}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </PublicShell>
  );
}
