/**
 * Gallery — Masonry-like grid with rotation hover, improved lightbox
 * transitions, and skeleton placeholders for loading images.
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { expoOut, staggerContainer, staggerItem } from "@/lib/motion";

const galleryImages = [
  { src: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=600&q=80", alt: "Echipa în acțiune", category: "Echipă" },
  { src: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80", alt: "Antrenament pe teren", category: "Antrenament" },
  { src: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=600&q=80", alt: "Jucători pe teren", category: "Meci" },
  { src: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=600&q=80", alt: "Minge de fotbal", category: "Echipament" },
  { src: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&q=80", alt: "Stadion de fotbal", category: "Teren" },
  { src: "https://images.unsplash.com/photo-1522778119026-d647f0565c6a?w=600&q=80", alt: "Echipa la antrenament", category: "Antrenament" },
  { src: "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=600&q=80", alt: "Copii fotbal", category: "Copii" },
  { src: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&q=80", alt: "Fotbal competiție", category: "Competiție" },
];

export default function Gallery() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const handlePrevious = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + galleryImages.length) % galleryImages.length);
    }
  }, [selectedIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % galleryImages.length);
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") handlePrevious();
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "Escape") setSelectedIndex(null);
  }, [handlePrevious, handleNext]);

  const handleImageLoad = useCallback((index: number) => {
    setLoadedImages(prev => new Set(prev).add(index));
  }, []);

  return (
    <section id="galerie" className="relative section-padding overflow-hidden" ref={ref}>
      <div className="container">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: expoOut }}
          className="max-w-2xl mb-8 sm:mb-12"
        >
          <span className="font-heading text-xs sm:text-sm uppercase tracking-[0.25em] text-cyan mb-3 sm:mb-4 block">
            Galerie Foto
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold uppercase leading-[0.95] text-white mb-4 sm:mb-6">
            Momente din<br />
            <span className="text-gradient-gold">Istorie</span>
          </h2>
          <p className="font-body text-base sm:text-lg text-white/70 leading-relaxed">
            Explorează momentele memorabile din istoria Școlii de Fotbal Dan Matei.
          </p>
        </motion.div>

        {/* Gallery Grid */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4"
          variants={staggerContainer(0.06)}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {galleryImages.map((image, index) => (
            <motion.button
              key={index}
              variants={staggerItem(0.4)}
              onClick={() => setSelectedIndex(index)}
              className={`group relative overflow-hidden rounded-xl sm:rounded-2xl cursor-pointer aspect-square ${
                index === 0 || index === 5 ? "col-span-2 row-span-2 aspect-auto" : ""
              }`}
              whileHover={{ rotate: index % 2 === 0 ? 1 : -1, scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              {/* Skeleton placeholder */}
              {!loadedImages.has(index) && (
                <div className="absolute inset-0 bg-[oklch(0.14_0.02_250)] animate-pulse rounded-xl sm:rounded-2xl" />
              )}

              <img
                src={image.src}
                alt={image.alt}
                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${
                  loadedImages.has(index) ? "opacity-100" : "opacity-0"
                }`}
                loading="lazy"
                onLoad={() => handleImageLoad(index)}
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.08_0.02_250/0.8)] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Category Badge */}
              <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-cyan/90 text-[oklch(0.08_0.02_250)] font-heading text-[10px] sm:text-xs uppercase tracking-wider px-2 sm:px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {image.category}
              </div>

              {/* Hover Icon */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(16px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setSelectedIndex(null)}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, filter: "blur(8px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ scale: 0.85, opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.3, ease: expoOut }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full h-full sm:h-auto sm:max-w-5xl sm:w-[90%] flex flex-col items-center justify-center p-4"
            >
              <img
                src={galleryImages[selectedIndex].src}
                alt={galleryImages[selectedIndex].alt}
                className="w-full h-auto max-h-[80vh] sm:max-h-[75vh] object-contain rounded-lg sm:rounded-xl"
              />
              <div className="mt-3 sm:mt-4 text-center">
                <span className="font-body text-sm sm:text-base text-white/80">{galleryImages[selectedIndex].alt}</span>
              </div>

              {/* Close */}
              <button onClick={() => setSelectedIndex(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white/10 hover:bg-white/20 text-white p-2.5 sm:p-3 rounded-full transition-colors touch-target z-10" aria-label="Închide">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              {/* Navigation */}
              <button onClick={handlePrevious} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-2.5 sm:p-3 rounded-full transition-colors touch-target z-10" aria-label="Anterior">
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button onClick={handleNext} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-2.5 sm:p-3 rounded-full transition-colors touch-target z-10" aria-label="Următor">
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              {/* Counter & Dots */}
              <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-10">
                <div className="bg-white/10 backdrop-blur-sm text-white px-4 py-1.5 rounded-full font-body text-xs sm:text-sm">
                  {selectedIndex + 1} / {galleryImages.length}
                </div>
                <div className="flex gap-1.5">
                  {galleryImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all duration-200 ${
                        idx === selectedIndex ? "bg-cyan w-5" : "bg-white/30"
                      }`}
                      aria-label={`Imaginea ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
