/**
 * /galerie — Public photo + video gallery. Reads `fotbal.media` and
 * resolves the storage path to a signed URL for private items, or a
 * public URL for the public buckets. Falls back to a static cover grid
 * when the DB is empty.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Image as ImageIcon, Play, Trophy, Dumbbell, Swords, Users, MapPin, Award } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { expoOut } from "@/lib/motion";

interface MediaRow {
  id: string;
  kind: "image" | "video";
  storage_path: string;
  mime: string;
  caption: string | null;
  created_at: string;
}

const FALLBACK_TILES: Array<{ id: string; label: string; tint: string; icon: typeof Trophy }> = [
  { id: "f1", label: "Cupa Transilvaniei · U13", tint: "from-brand-cyan/30", icon: Trophy },
  { id: "f2", label: "Antrenament U7", tint: "from-[oklch(0.65_0.22_50)]/25", icon: Dumbbell },
  { id: "f3", label: "Meci U11", tint: "from-[oklch(0.55_0.20_280)]/25", icon: Swords },
  { id: "f4", label: "Echipa tehnică", tint: "from-brand-cyan/25", icon: Users },
  { id: "f5", label: "Stadionul Mănăștur", tint: "from-[oklch(0.85_0.16_90)]/15", icon: MapPin },
  { id: "f6", label: "Festivitatea de premiere", tint: "from-brand-gold/20", icon: Award },
];

function resolvePublicUrl(path: string): string {
  // News covers + trainer portraits live in public buckets; private
  // child-tagged media stays in fotbal-media-private and would need a
  // signed URL, but the gallery only surfaces public-facing rows.
  const bucket = path.startsWith("trainer/")
    ? "fotbal-trainer-public"
    : path.startsWith("news/")
      ? "fotbal-news-public"
      : "fotbal-trainer-public";
  const cleanPath = path.replace(/^trainer\/|^news\//, "");
  const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
  return data.publicUrl;
}

export default function Galerie() {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const timeoutId = setTimeout(() => { if (cancelled) return; setItems([]); setLoading(false); }, 6000);
    void (async () => {
      const { data } = await supabase
        .from("media")
        .select("id, kind, storage_path, mime, caption, created_at")
        .is("child_id", null) // public-facing only — child-tagged media is private
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled) return;
      clearTimeout(timeoutId);
      setItems((data as MediaRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const showFallback = !loading && items.length === 0;

  const tiles = useMemo(
    () =>
      items.map(it => ({
        id: it.id,
        kind: it.kind,
        url: resolvePublicUrl(it.storage_path),
        caption: it.caption,
      })),
    [items]
  );

  return (
    <PublicShell
      pageKicker="Galerie"
      pageTitle="Momente de pe teren"
      pageDescription="Antrenamente, meciuri și sărbători din viața academiei."
    >
      {loading && (
        <div className="grid place-items-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      )}

      {showFallback ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {FALLBACK_TILES.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: expoOut }}
              className={`relative aspect-square overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br ${t.tint} via-[oklch(0.13_0.03_250)] to-[oklch(0.10_0.025_250)]`}
            >
              <span className="pointer-events-none absolute inset-0 grid place-items-center">
                <t.icon className="size-10 text-white/20" />
              </span>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                <p className="font-body text-sm font-medium text-white">{t.label}</p>
              </span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {tiles.map((tile, i) => (
            <motion.figure
              key={tile.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: expoOut }}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-white/8 bg-[oklch(0.10_0.025_250)]"
            >
              {tile.kind === "image" ? (
                <img
                  src={tile.url}
                  alt={tile.caption ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <>
                  <video
                    src={tile.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  <span className="pointer-events-none absolute inset-0 grid place-items-center">
                    <span className="grid size-12 place-items-center rounded-full border border-brand-cyan/40 bg-black/40 backdrop-blur-md">
                      <Play className="size-5 text-brand-cyan" />
                    </span>
                  </span>
                </>
              )}
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                <p className="font-body text-sm font-medium text-white">{tile.caption ?? "Fotografie"}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
