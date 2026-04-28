/**
 * /academie — Public "About the academy" page.
 * Pulls editable copy from `landing_content[slot=owner]` when present,
 * otherwise falls back to the static OWNER object.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, MapPin, Trophy, Users, Award } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { supabase } from "@/lib/supabase";
import { OWNER, type Owner } from "@/data/landing";
import { expoOut } from "@/lib/motion";

interface OwnerLandingPayload {
  owner?: Partial<Owner>;
}

export default function Academie() {
  const [owner, setOwner] = useState<Owner>(OWNER);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("landing_content")
        .select("payload")
        .eq("slot", "owner")
        .maybeSingle();
      if (cancelled) return;
      const payload = data?.payload as OwnerLandingPayload | null;
      if (payload?.owner) {
        setOwner({ ...OWNER, ...payload.owner } as Owner);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicShell
      pageKicker="Despre noi"
      pageTitle="Academia care formează fotbaliști — și oameni"
      pageDescription="Suntem o academie de fotbal pentru copii din Cluj-Napoca, înființată în 2017. Lucrăm cu antrenori cu licență UEFA și grupe pe vârste, cu accent pe individual development și caracter."
    >
      {/* Stats strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {owner.stats.map((s, i) => {
          const isAchievement = s.label.toLowerCase().includes("trofee");
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: expoOut }}
              className={`rounded-2xl border p-4 sm:p-5 ${
                isAchievement
                  ? "border-brand-gold/25 bg-brand-gold/5"
                  : "border-brand-cyan/15 bg-brand-cyan/[0.04]"
              }`}
            >
              <div
                className={`font-heading text-3xl font-bold tabular-nums ${
                  isAchievement ? "text-brand-gold" : "text-brand-cyan"
                }`}
              >
                {s.value}
              </div>
              <div className="mt-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/55">
                {s.label}
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* Founder quote */}
      <section className="mt-10 grid gap-6 sm:mt-14 lg:grid-cols-[1.3fr_1fr]">
        <motion.figure
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: expoOut }}
          className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/60 p-6 sm:p-9"
        >
          <span className="font-heading text-[10px] uppercase tracking-[0.22em] text-brand-cyan">
            Fondator
          </span>
          <blockquote className="mt-3 font-heading text-2xl leading-snug text-white sm:text-3xl">
            “{owner.quote}”
          </blockquote>
          <figcaption className="mt-5 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-brand-cyan/30 to-brand-navy font-heading font-bold uppercase tracking-wider text-white">
              {owner.name
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </span>
            <span>
              <span className="block font-heading text-base font-semibold text-white">
                {owner.name}
              </span>
              <span className="block font-body text-xs text-white/55">
                {owner.role}
              </span>
            </span>
          </figcaption>
        </motion.figure>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: expoOut }}
          className="grid gap-3"
        >
          <InfoCard
            icon={<MapPin className="size-4" />}
            title="Bază sportivă proprie"
            body="Mănăștur, Cluj-Napoca · gazon profesional · vestiar dedicat"
          />
          <InfoCard
            icon={<Award className="size-4" />}
            title="Antrenori cu licență UEFA"
            body="5 antrenori certificați, cu experiență în fotbalul de performanță"
          />
          <InfoCard
            icon={<Trophy className="size-4" />}
            title="Cupa Transilvaniei × 2"
            body="Două ediții consecutive câștigate cu grupa U13"
          />
          <InfoCard
            icon={<Users className="size-4" />}
            title="Maxim 14 copii / grupă"
            body="Atenție individuală, rapoarte lunare către părinți"
          />
        </motion.div>
      </section>

      {/* Reasons */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold uppercase tracking-[0.04em] text-white sm:text-3xl">
          De ce să ne alegi
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {owner.reasons.map((r, i) => (
            <motion.article
              key={r.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: expoOut }}
              className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/40 p-5 sm:p-6"
            >
              <CheckCircle2 className="size-5 text-brand-cyan" />
              <h3 className="mt-3 font-heading text-base font-semibold uppercase tracking-wider text-white">
                {r.title}
              </h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-white/65">
                {r.body}
              </p>
            </motion.article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  body: string;
}

function InfoCard({ icon, title, body }: InfoCardProps) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/40 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-cyan/10 text-brand-cyan">
        {icon}
      </span>
      <div>
        <p className="font-heading text-sm font-semibold uppercase tracking-wider text-white">
          {title}
        </p>
        <p className="mt-1 font-body text-xs leading-relaxed text-white/55">
          {body}
        </p>
      </div>
    </div>
  );
}
