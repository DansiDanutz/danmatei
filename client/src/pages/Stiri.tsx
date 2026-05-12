/**
 * /stiri — Public news feed. Reads `fotbal.news` where audience='public'
 * (and any members-audience rows when the visitor is signed in).
 * Falls back to a small set of placeholder posts when empty or when
 * Supabase is unavailable (e.g. env vars not yet provisioned).
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Newspaper, Tag } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import DemoBanner from "@/components/DemoBanner";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { expoOut } from "@/lib/motion";

function resolveNewsCoverUrl(path: string | null): string | undefined {
  if (!path) return undefined;
    const clean = path;
  return supabase.storage.from("fotbal-news-public").getPublicUrl(clean).data.publicUrl;
}

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
      "Începem înscrierile pentru noul an. Avem locuri pentru U6 până la U15. Antrenamentele luni–vineri 16:00–19:00 la Baza Unirea (Mănăștur) și la Baza Cotton (Grigorescu).",
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
  {
    id: "demo-3",
    title: "Nou antrenor pentru grupa U9 – Bun venit, Alexandru Popa!",
    body_md:
      "Alexandru Popa, licență UEFA B, se alătură echipei noastre tehnice pentru grupele mici. Antrenamentele continuă la Baza Unirea și Baza Cotton.",
    cover_path: null,
    audience: "public",
    published_at: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
];

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Bucharest",
});

export default function Stiri() {
  const [posts, setPosts] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // If Supabase is not configured, skip the query and show fallback immediately
    if (!isSupabaseConfigured) {
      setUsingFallback(true);
      setPosts(FALLBACK_NEWS);
      setLoading(false);
      return;
    }

    // Race the DB query against a 6-second timeout so users never see
    // an infinite spinner when the backend is unreachable.
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      setUsingFallback(true);
      setPosts(FALLBACK_NEWS);
      setLoading(false);
    }, 6000);

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("news")
          .select("id, title, body_md, cover_path, audience, published_at")
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
          .limit(40);

        if (cancelled) return;
        clearTimeout(timeoutId);

        if (error || !data) {
          setUsingFallback(true);
          setPosts(FALLBACK_NEWS);
        } else {
          const rows = data as NewsRow[];
          const fallback = rows.length === 0;
          setUsingFallback(fallback);
          setPosts(fallback ? FALLBACK_NEWS : rows);
        }
      } catch {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setUsingFallback(true);
        setPosts(FALLBACK_NEWS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <PublicShell
      pageKicker="Știri"
      pageTitle="Ultimele noutăți"
      pageDescription="Articole, anunțuri, rezultate și momente importante din viața academiei."
    >
      {usingFallback && <DemoBanner />}
      {loading && (
        <div className="grid place-items-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      )}
      {!loading && (
        <div className="grid gap-3 sm:gap-4">
          {posts.map((p, i) => {
            const date = p.published_at
              ? dateFormatter.format(new Date(p.published_at))
              : "—";
            return (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04, ease: expoOut }}
                className="group flex items-start gap-4 overflow-hidden rounded-2xl border border-white/8 bg-[oklch(0.11_0.02_250)] p-4 transition-colors hover:border-brand-cyan/30 sm:p-5"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl sm:size-20">
                  {p.cover_path ? (
                    <img
                      src={resolveNewsCoverUrl(p.cover_path)}
                      alt={p.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center bg-gradient-to-br from-brand-cyan/20 to-brand-navy/40">
                      <Newspaper className="size-6 text-brand-cyan/60" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[11px] text-white/45">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3 text-brand-cyan/70" />
                      {date}
                    </span>
                    <span className="inline-flex items-center gap-1 capitalize">
                      <Tag className="size-3 text-brand-cyan/70" />
                      {p.audience === "public" ? "public" : p.audience === "members" ? "membri" : "grupă"}
                    </span>
                  </div>
                  <h2 className="mt-1.5 font-heading text-base font-bold uppercase leading-tight tracking-[0.04em] text-white sm:text-lg">
                    {p.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 font-body text-sm leading-relaxed text-white/60">
                    {p.body_md}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </PublicShell>
  );
}
