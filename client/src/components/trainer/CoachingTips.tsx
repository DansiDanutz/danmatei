/**
 * CoachingTips — the "Sfaturi" feed: the daily coaching digest delivered to a
 * trainer/owner. Reads fotbal.coaching_tips for the current user (RLS-scoped),
 * shows today's tip prominently with a collapsible history.
 *
 * Tips are produced once a day by /api/cron/coaching-digest, tailored to the
 * trainer's age band (or a leadership digest for the owner).
 */
import { useEffect, useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tip = {
  id: string;
  title: string;
  body_md: string;
  source: string | null;
  theme: string | null;
  age_band: string | null;
  tip_date: string;
};

function dateRO(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Bucharest",
  });
}

export default function CoachingTips({ recipientId }: { recipientId: string }) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!recipientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("coaching_tips")
        .select("id, title, body_md, source, theme, age_band, tip_date")
        .eq("recipient_id", recipientId)
        .order("tip_date", { ascending: false })
        .limit(14);
      if (cancelled) return;
      setTips((data ?? []) as Tip[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [recipientId]);

  if (loading || tips.length === 0) return null;

  const [latest, ...older] = tips;

  return (
    <section className="rounded-3xl border border-brand-gold/25 bg-gradient-to-br from-brand-gold/[0.08] to-transparent p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-4 text-brand-gold" />
        <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-brand-gold/90">
          Sfatul zilei
        </h2>
        {latest.age_band && (
          <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-heading text-[9px] uppercase tracking-[0.14em] text-white/55">
            {latest.age_band}
          </span>
        )}
      </div>

      <h3 className="mt-3 font-heading text-lg font-bold leading-tight text-white sm:text-xl">
        {latest.title}
      </h3>
      <p className="mt-2 font-body text-sm leading-relaxed text-white/80">
        {latest.body_md}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {latest.source && (
          <span className="inline-flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-[0.12em] text-brand-gold/80">
            <BookOpen className="size-3" />
            {latest.source}
          </span>
        )}
        <span className="font-body text-[11px] text-white/40">
          {dateRO(latest.tip_date)}
        </span>
      </div>

      {older.length > 0 && (
        <div className="mt-4 border-t border-white/8 pt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-brand-gold"
          >
            {showHistory ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            Sfaturi anterioare ({older.length})
          </button>

          {showHistory && (
            <div className="mt-3 grid gap-2.5">
              {older.map((t) => (
                <article
                  key={t.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-heading text-sm font-semibold text-white">
                      {t.title}
                    </h4>
                    <span className="font-body text-[10px] text-white/40">
                      {dateRO(t.tip_date)}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-xs leading-relaxed text-white/65">
                    {t.body_md}
                  </p>
                  {t.source && (
                    <span className="mt-1.5 inline-block font-heading text-[9px] uppercase tracking-[0.12em] text-brand-gold/70">
                      {t.source}
                    </span>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
