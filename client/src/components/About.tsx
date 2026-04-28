/**
 * About — Brand-authentic design with ken-burns photo,
 * animated value cards with icon micro-animation,
 * and gold shimmer on coach card.
 */
import { motion, useScroll, useTransform } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Trophy, Heart, Shield, GraduationCap } from "lucide-react";
import { expoOut, staggerContainer, staggerItem, hoverLift, tapScale } from "@/lib/motion";

const values = [
  { icon: Heart, title: "Pasiune", description: "Iubirea pentru fotbal este fundamentul a tot ceea ce facem." },
  { icon: GraduationCap, title: "Educație", description: "Dezvoltăm abilități tehnice, caracter și disciplină." },
  { icon: Shield, title: "Fair-Play", description: "Respectul pentru adversar și regulile jocului." },
  { icon: Trophy, title: "Profesionalism", description: "Antrenamente structurate și metodologie modernă." },
];

export default function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const imgRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: imgRef,
    offset: ["start end", "end start"],
  });
  const imgScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.08, 1.12, 1.08]);

  return (
    <section id="despre" className="relative section-padding overflow-hidden" ref={ref}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: Text Content */}
          <div className="order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: expoOut }}
            >
              <span className="font-heading text-xs sm:text-sm uppercase tracking-[0.25em] text-brand-cyan mb-3 sm:mb-4 block">
                Despre Noi
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold uppercase leading-[0.95] text-white mb-5 sm:mb-6">
                Formăm<br />
                <span className="text-gradient-gold">Campioni</span>
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15, ease: expoOut }}
            >
              <p className="font-body text-base sm:text-lg text-white/70 leading-relaxed mb-4">
                ACS Școala de Fotbal Dan Matei a fost fondată în 2017 în Cluj-Napoca cu misiunea de a oferi copiilor și tinerilor o educație sportivă completă. Sub conducerea antrenorului Dan Matei, deținător al licenței UEFA, academia noastră a format peste 100 de sportivi.
              </p>
              <p className="font-body text-base sm:text-lg text-white/70 leading-relaxed mb-6 sm:mb-8">
                Antrenamentele se desfășoară la Baza Sportivă Mănăștur. Motto-ul nostru, <span className="text-brand-cyan font-semibold">"Work hard, Feel good"</span>, reflectă filosofia noastră.
              </p>
            </motion.div>

            {/* Coach Card with gold shimmer */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.25, ease: expoOut }}
              className="relative inline-flex items-center gap-3 sm:gap-4 bg-[oklch(0.12_0.02_250)] border border-brand-gold/20 rounded-xl px-4 sm:px-6 py-3 sm:py-4 overflow-hidden group"
            >
              {/* Gold shimmer effect */}
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, oklch(0.75 0.14 85 / 0.06) 45%, oklch(0.75 0.14 85 / 0.12) 50%, oklch(0.75 0.14 85 / 0.06) 55%, transparent 60%)",
                }}
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: "linear" }}
              />
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-brand-gold/50 bg-white">
                <img src="/logo-official.jpg" alt="Dan Matei" className="w-full h-full object-cover" />
              </div>
              <div className="relative z-10">
                <span className="font-heading text-sm uppercase tracking-wider text-white block">
                  Antrenor Dan Matei
                </span>
                <span className="font-body text-xs text-white/50">
                  Fondator • Licență UEFA
                </span>
              </div>
            </motion.div>
          </div>

          {/* Right: Team Photo with Ken Burns */}
          <motion.div
            ref={imgRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.2, ease: expoOut }}
            className="order-1 lg:order-2 relative"
          >
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] lg:aspect-auto lg:h-[500px]">
              <motion.img
                src="/team-photo.jpg"
                alt="Echipa Școala de Fotbal Dan Matei"
                className="w-full h-full object-cover"
                loading="lazy"
                style={{ scale: imgScale }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.08_0.02_250)] via-transparent to-transparent" />
              {/* Logo watermark */}
              <div className="absolute bottom-4 right-4 w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 bg-white/10 backdrop-blur-sm">
                <img src="/logo-official.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            {/* Decorative border with pulse */}
            <motion.div
              className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-full h-full border-2 border-brand-cyan/20 rounded-2xl -z-10"
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>

        {/* Values Grid with stagger + icon bounce */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mt-12 sm:mt-16 lg:mt-20"
          variants={staggerContainer(0.08)}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {values.map((value) => (
            <motion.div
              key={value.title}
              variants={staggerItem()}
              whileHover={hoverLift}
              whileTap={tapScale}
              className="group bg-[oklch(0.10_0.02_250)] border border-white/5 rounded-xl p-4 sm:p-6 hover:border-brand-cyan/30 transition-all duration-500 cursor-default"
            >
              <motion.div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-brand-cyan/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-brand-cyan/20 transition-colors"
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <value.icon className="w-5 h-5 sm:w-6 sm:h-6 text-brand-cyan" />
              </motion.div>
              <h3 className="font-heading text-base sm:text-xl uppercase tracking-wider text-white mb-1.5 sm:mb-2">
                {value.title}
              </h3>
              <p className="font-body text-xs sm:text-sm text-white/50 leading-relaxed">
                {value.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
