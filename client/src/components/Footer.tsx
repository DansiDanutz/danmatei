/**
 * Footer — Wave divider, social icon bounce, back-to-top button
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Facebook, Mail, Phone, MapPin, Heart, ArrowUp } from "lucide-react";
import { tapScale } from "@/lib/motion";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <footer className="relative bg-[oklch(0.06_0.02_250)]">
      {/* Animated wave divider */}
      <div aria-hidden="true" className="absolute top-0 left-0 right-0 -translate-y-[99%] overflow-hidden">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-8 sm:h-12">
          <motion.path
            d="M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z"
            fill="oklch(0.06 0.02 250)"
            initial={{ d: "M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z" }}
            animate={{
              d: [
                "M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z",
                "M0 60V35C240 10 480 50 720 25C960 0 1200 45 1440 35V60H0Z",
                "M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z",
              ],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </div>

      <div className="container py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 mb-10 sm:mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <motion.div
                className="w-12 h-12 rounded-full border border-brand-cyan/30 overflow-hidden bg-white flex-shrink-0"
                whileHover={{ scale: 1.1, boxShadow: "0 0 20px oklch(0.75 0.12 230 / 0.3)" }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <img src="/logo-official.jpg" alt="Logo" className="w-full h-full object-cover" />
              </motion.div>
              <div>
                <span className="font-heading text-sm font-bold uppercase tracking-wider text-white block leading-none">
                  Dan Matei
                </span>
                <span className="font-body text-[10px] uppercase tracking-[0.2em] text-brand-cyan">
                  Școala de Fotbal
                </span>
              </div>
            </div>
            <p className="font-body text-sm text-white/50 leading-relaxed max-w-xs">
              Formând viitorul fotbalului românesc prin pasiune, educație și fair-play. Din 2017, Cluj-Napoca.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading text-sm uppercase tracking-[0.15em] text-white mb-5 font-bold">
              Navigare
            </h3>
            <ul className="space-y-3">
              {[
                { label: "Acasă", href: "#acasa" },
                { label: "Despre Noi", href: "#despre" },
                { label: "Programe", href: "#programe" },
                { label: "Galerie", href: "#galerie" },
                { label: "Rezultate", href: "#rezultate" },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="font-body text-sm text-white/60 hover:text-brand-cyan transition-colors inline-flex items-center gap-1 touch-target group"
                  >
                    <span className="w-0 group-hover:w-2 h-px bg-brand-cyan transition-all duration-300" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading text-sm uppercase tracking-[0.15em] text-white mb-5 font-bold">
              Contact
            </h3>
            <ul className="space-y-3">
              <li>
                <a href="tel:0744311147" className="flex items-center gap-2.5 font-body text-sm text-white/60 hover:text-brand-cyan transition-colors touch-target">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  0744 311 147
                </a>
              </li>
              <li>
                <a href="mailto:zzizzou5@yahoo.com" className="flex items-center gap-2.5 font-body text-sm text-white/60 hover:text-brand-cyan transition-colors touch-target">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  zzizzou5@yahoo.com
                </a>
              </li>
              <li className="flex items-start gap-2.5 font-body text-sm text-white/60">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Baza Sportivă Mănăștur, Cluj-Napoca</span>
              </li>
            </ul>
          </div>

          {/* Social with bounce */}
          <div>
            <h3 className="font-heading text-sm uppercase tracking-[0.15em] text-white mb-5 font-bold">
              Urmărește-ne
            </h3>
            <div className="flex flex-col gap-3">
              <motion.a
                href="https://www.facebook.com/share/1GEmo1NpaV/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 bg-[oklch(0.10_0.02_250)] border border-white/10 text-white px-4 py-2.5 rounded-xl hover:border-brand-cyan/50 hover:text-brand-cyan transition-all touch-target w-full sm:w-auto"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={tapScale}
              >
                <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                  <Facebook className="w-4 h-4" />
                </motion.div>
                <span className="font-body text-sm">Facebook</span>
              </motion.a>
              <motion.a
                href="tel:0744311147"
                className="inline-flex items-center gap-2.5 bg-[oklch(0.10_0.02_250)] border border-white/10 text-white px-4 py-2.5 rounded-xl hover:border-brand-cyan/50 hover:text-brand-cyan transition-all touch-target w-full sm:w-auto"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={tapScale}
              >
                <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                  <Phone className="w-4 h-4" />
                </motion.div>
                <span className="font-body text-sm">Sună Acum</span>
              </motion.a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5 pt-6 sm:pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-body text-xs text-white/40 text-center sm:text-left">
              © {currentYear} ACS Școala de Fotbal Dan Matei. Toate drepturile rezervate.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10 bg-white/5">
                <img src="/logo-official.jpg" alt="Logo" className="w-full h-full object-cover opacity-60" />
              </div>
              <p className="font-body text-xs text-white/30 flex items-center gap-1">
                Făcut cu <Heart className="w-3 h-3 text-brand-gold" /> în Cluj-Napoca
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Back to top */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan flex items-center justify-center hover:bg-brand-cyan/30 transition-colors backdrop-blur-sm touch-target"
            aria-label="Înapoi sus"
            whileHover={{ scale: 1.1 }}
            whileTap={tapScale}
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </footer>
  );
}
