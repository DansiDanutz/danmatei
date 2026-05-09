/**
 * Navbar — Active section indicator, smoother mobile transitions,
 * logo hover glow, scroll-aware background.
 */
import { useState, useEffect } from "react";
import { Menu, X, Phone, PhoneCall } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { expoOut } from "@/lib/motion";

const navLinks = [
  { label: "Acasă", href: "#acasa" },
  { label: "Despre Noi", href: "#despre" },
  { label: "Programe", href: "#programe" },
  { label: "Galerie", href: "#galerie" },
  { label: "Rezultate", href: "#rezultate" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      // Determine active section based on scroll position
      const sections = navLinks.map((l) => l.href.replace("#", ""));
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) {
            setActiveSection(sections[i]);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || mobileOpen
            ? "bg-[oklch(0.08_0.02_250/0.98)] backdrop-blur-xl shadow-lg shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="container flex items-center justify-between h-16 sm:h-20">
          {/* Logo with hover glow */}
          <a href="#acasa" className="flex items-center gap-2.5 sm:gap-3 group">
            <motion.div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-brand-cyan/60 group-hover:border-brand-cyan transition-colors flex-shrink-0 bg-white"
              whileHover={{ boxShadow: "0 0 20px oklch(0.75 0.12 230 / 0.4)" }}
              transition={{ duration: 0.3 }}
            >
              <img
                src="/logo-official.jpg"
                alt="Logo Școala de Fotbal Dan Matei"
                className="w-full h-full object-cover"
              />
            </motion.div>
            <div className="hidden sm:block">
              <span className="font-heading text-base lg:text-lg font-bold uppercase tracking-wider text-white leading-none block">
                Dan Matei
              </span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-brand-cyan font-medium">
                Școala de Fotbal
              </span>
            </div>
          </a>

          {/* Desktop Nav with active indicator */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8">
            {navLinks.map((link) => {
              const sectionId = link.href.replace("#", "");
              const isActive = activeSection === sectionId;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`font-heading text-xs xl:text-sm uppercase tracking-[0.12em] transition-colors duration-300 relative py-1 ${
                    isActive
                      ? "text-brand-cyan"
                      : "text-white/80 hover:text-brand-cyan"
                  }`}
                >
                  {link.label}
                  {/* Active underline indicator */}
                  <motion.span
                    className="absolute bottom-[-4px] left-0 h-[2px] bg-brand-cyan rounded-full"
                    initial={false}
                    animate={{ width: isActive ? "100%" : "0%" }}
                    transition={{ duration: 0.3, ease: expoOut }}
                  />
                </a>
              );
            })}
            <a
              href="tel:0744311147"
              className="flex items-center gap-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan px-4 py-2.5 rounded-lg font-heading text-xs uppercase tracking-wider hover:bg-brand-cyan/20 transition-all duration-300"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden xl:inline">0744 311 147</span>
              <span className="xl:hidden">Sună</span>
            </a>
            <a
              href="/programare"
              className="flex items-center gap-2 bg-brand-cyan text-[oklch(0.08_0.02_250)] px-4 py-2.5 rounded-lg font-heading text-xs uppercase tracking-wider hover:opacity-90 transition-all duration-300 shadow-[0_0_30px_-8px_oklch(0.78_0.13_210/0.55)]"
            >
              <PhoneCall className="w-4 h-4" />
              Programează
            </a>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-white p-2.5 rounded-lg hover:bg-white/10 transition-colors touch-target flex items-center justify-center"
            aria-label={mobileOpen ? "Închide meniul" : "Deschide meniul"}
          >
            <AnimatePresence mode="wait">
              {mobileOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="w-6 h-6" />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Menu className="w-6 h-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </nav>

      {/* Full-Screen Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-[oklch(0.08_0.02_250/0.98)] backdrop-blur-xl lg:hidden pt-16"
          >
            <div className="container h-full flex flex-col">
              {/* Logo in mobile menu */}
              <div className="flex items-center gap-3 py-4 border-b border-white/5">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-brand-cyan/50 bg-white">
                  <img src="/logo-official.jpg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="font-heading text-lg font-bold uppercase tracking-wider text-white block leading-none">
                    Dan Matei
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-brand-cyan">
                    Școala de Fotbal
                  </span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center gap-1 py-8">
                {navLinks.map((link, index) => {
                  const sectionId = link.href.replace("#", "");
                  const isActive = activeSection === sectionId;
                  return (
                    <motion.a
                      key={link.href}
                      href={link.href}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05, ease: expoOut }}
                      onClick={() => setMobileOpen(false)}
                      className={`font-heading text-2xl sm:text-3xl uppercase tracking-[0.1em] transition-colors py-4 border-b border-white/5 touch-target flex items-center ${
                        isActive ? "text-brand-cyan" : "text-white/90 hover:text-brand-cyan"
                      }`}
                    >
                      <span className="text-brand-cyan/50 text-sm mr-4 font-body">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {link.label}
                    </motion.a>
                  );
                })}
              </div>

              {/* Mobile Menu Footer */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="py-6 border-t border-white/5 space-y-3"
              >
                <a
                  href="/programare"
                  className="flex items-center justify-center gap-3 bg-brand-cyan text-[oklch(0.08_0.02_250)] px-6 py-4 rounded-xl font-heading text-base uppercase tracking-wider touch-target w-full shadow-[0_0_40px_-10px_oklch(0.78_0.13_210/0.6)]"
                  onClick={() => setMobileOpen(false)}
                >
                  <PhoneCall className="w-5 h-5" />
                  Vorbește cu un consilier
                </a>
                <a
                  href="tel:0744311147"
                  className="flex items-center justify-center gap-3 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan px-6 py-4 rounded-xl font-heading text-sm uppercase tracking-wider touch-target w-full"
                  onClick={() => setMobileOpen(false)}
                >
                  <Phone className="w-4 h-4" />
                  0744 311 147
                </a>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
