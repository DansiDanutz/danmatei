/**
 * Contact — Focus ring animations, submit shimmer,
 * and left border accent on card hover.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Phone, Mail, MapPin, Clock, Send, Facebook, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { expoOut, staggerContainer, staggerItem, tapScale } from "@/lib/motion";

const contactInfo = [
  { icon: Phone, label: "Telefon", value: "0744 311 147", href: "tel:0744311147", action: "Sună acum" },
  { icon: Mail, label: "Email", value: "zzizzou5@yahoo.com", href: "mailto:zzizzou5@yahoo.com", action: "Trimite email" },
  { icon: MapPin, label: "Locație", value: "Baza Sportivă Mănăștur, Cluj", href: "https://maps.google.com/?q=Baza+Sportiva+Manastur+Cluj", action: "Vezi harta", external: true },
  { icon: Clock, label: "Program", value: "Luni - Vineri: 16:00 - 19:00", href: "#", action: null },
];

export default function Contact() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      toast.success("Mesajul a fost trimis cu succes! Te vom contacta în curând.");
      setFormData({ name: "", email: "", phone: "", message: "" });
      setLoading(false);
    }, 1000);
  };

  return (
    <section id="contact" className="relative section-padding overflow-hidden" ref={ref}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Left: Contact Info */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: expoOut }}
            >
              <span className="font-heading text-xs sm:text-sm uppercase tracking-[0.25em] text-cyan mb-3 sm:mb-4 block">
                Contact
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold uppercase leading-[0.95] text-white mb-6 sm:mb-8">
                Ia<br />
                <span className="text-gradient-gold">Contact</span>
              </h2>
            </motion.div>

            {/* Contact Cards with left border accent */}
            <motion.div
              className="space-y-3 sm:space-y-4"
              variants={staggerContainer(0.08)}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
            >
              {contactInfo.map((info) => (
                <motion.a
                  key={info.label}
                  href={info.href}
                  target={info.external ? "_blank" : undefined}
                  rel={info.external ? "noopener noreferrer" : undefined}
                  variants={staggerItem()}
                  className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-[oklch(0.12_0.02_250)] border border-white/5 hover:border-brand-cyan/30 transition-all duration-300 relative overflow-hidden"
                  whileHover={{ x: 4 }}
                >
                  {/* Left border accent on hover */}
                  <span className="absolute left-0 top-0 bottom-0 w-0 group-hover:w-1 bg-brand-cyan rounded-l-xl transition-all duration-300" />

                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-cyan/10 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan/20 transition-colors">
                    <info.icon className="w-5 h-5 sm:w-6 sm:h-6 text-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-heading text-[10px] sm:text-xs uppercase tracking-[0.15em] text-white/50 block mb-0.5">
                      {info.label}
                    </span>
                    <span className="font-body text-sm sm:text-base text-white group-hover:text-cyan transition-colors truncate block">
                      {info.value}
                    </span>
                  </div>
                  {info.action && (
                    <span className="hidden sm:inline-flex font-heading text-[10px] uppercase tracking-wider text-cyan/60 group-hover:text-cyan transition-colors flex-shrink-0">
                      {info.action}
                    </span>
                  )}
                </motion.a>
              ))}
            </motion.div>

            {/* Social Links */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4, ease: expoOut }}
              className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-white/10"
            >
              <p className="font-body text-sm sm:text-base text-white/60 mb-4">
                Urmărește-ne pentru ultimele noutăți:
              </p>
              <div className="flex flex-wrap gap-3">
                <motion.a
                  href="https://www.facebook.com/share/1GEmo1NpaV/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[oklch(0.14_0.025_250)] border border-white/10 text-white px-4 py-2.5 rounded-xl hover:border-cyan/50 hover:text-cyan transition-all touch-target"
                  whileHover={{ scale: 1.03 }}
                  whileTap={tapScale}
                >
                  <Facebook className="w-4 h-4" />
                  <span className="font-body text-sm">Facebook</span>
                </motion.a>
                <motion.a
                  href="tel:0744311147"
                  className="inline-flex items-center gap-2 bg-[oklch(0.14_0.025_250)] border border-white/10 text-white px-4 py-2.5 rounded-xl hover:border-cyan/50 hover:text-cyan transition-all touch-target"
                  whileHover={{ scale: 1.03 }}
                  whileTap={tapScale}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="font-body text-sm">WhatsApp</span>
                </motion.a>
              </div>
            </motion.div>
          </div>

          {/* Right: Contact Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2, ease: expoOut }}
            onSubmit={handleSubmit}
            className="bg-[oklch(0.12_0.02_250)] border border-white/10 rounded-2xl p-5 sm:p-8"
          >
            <h3 className="font-heading text-lg sm:text-xl uppercase tracking-wider text-white mb-5 sm:mb-6">
              Trimite-ne un mesaj
            </h3>

            <div className="space-y-4 sm:space-y-5">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block font-heading text-xs uppercase tracking-wider text-white/70 mb-2">
                  Nume Complet
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-[oklch(0.08_0.02_250)] border border-white/10 rounded-xl px-4 py-3 sm:py-3.5 font-body text-white placeholder-white/30 focus:border-brand-cyan/50 focus:outline-none focus:shadow-[0_0_0_3px_oklch(0.75_0.12_230/0.15)] transition-all touch-target"
                  placeholder="Numele tău"
                />
              </div>

              {/* Email & Phone */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block font-heading text-xs uppercase tracking-wider text-white/70 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full bg-[oklch(0.08_0.02_250)] border border-white/10 rounded-xl px-4 py-3 sm:py-3.5 font-body text-white placeholder-white/30 focus:border-brand-cyan/50 focus:outline-none focus:shadow-[0_0_0_3px_oklch(0.75_0.12_230/0.15)] transition-all touch-target"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block font-heading text-xs uppercase tracking-wider text-white/70 mb-2">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-[oklch(0.08_0.02_250)] border border-white/10 rounded-xl px-4 py-3 sm:py-3.5 font-body text-white placeholder-white/30 focus:border-brand-cyan/50 focus:outline-none focus:shadow-[0_0_0_3px_oklch(0.75_0.12_230/0.15)] transition-all touch-target"
                    placeholder="0700 000 000"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block font-heading text-xs uppercase tracking-wider text-white/70 mb-2">
                  Mesaj
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={4}
                  className="w-full bg-[oklch(0.08_0.02_250)] border border-white/10 rounded-xl px-4 py-3 sm:py-3.5 font-body text-white placeholder-white/30 focus:border-brand-cyan/50 focus:outline-none focus:shadow-[0_0_0_3px_oklch(0.75_0.12_230/0.15)] transition-all resize-none"
                  placeholder="Scrie mesajul tău aici..."
                />
              </div>

              {/* Submit with shimmer */}
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan text-[oklch(0.08_0.02_250)] font-heading text-sm uppercase tracking-[0.12em] px-6 py-4 rounded-xl hover:bg-[oklch(0.82_0.15_200)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 glow-cyan flex items-center justify-center gap-2 touch-target relative overflow-hidden"
                whileTap={tapScale}
              >
                {loading && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, oklch(0.85 0.15 200 / 0.3) 50%, transparent 100%)",
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                )}
                {loading ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    Se trimite...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Trimite Mesajul
                  </>
                )}
              </motion.button>
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
