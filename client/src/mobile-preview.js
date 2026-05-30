const ready = (fn) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
};

const revealOnScroll = () => {
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;
  const reveal = (el) => el.classList.add("in");
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!("IntersectionObserver" in window) || reduced) {
    targets.forEach(reveal);
    return;
  }
  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
  );
  targets.forEach(el => io.observe(el));
  setTimeout(() => targets.forEach(reveal), 4000);
};

const countStats = () => {
  const cells = document.querySelectorAll(".stat-cell .v[data-count]");
  if (!cells.length) return;
  const animate = (el) => {
    const target = Number.parseInt(el.getAttribute("data-count") ?? "0", 10);
    const isPlus = (el.textContent ?? "").trim().endsWith("+");
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(target * eased);
      el.textContent = isPlus ? `${value}+` : `${value}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!("IntersectionObserver" in window)) {
    cells.forEach(animate);
    return;
  }
  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animate(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.5 }
  );
  cells.forEach(el => {
    el.textContent = "0";
    io.observe(el);
  });
};

const initFloatingCta = () => {
  const cta = document.getElementById("ctaPill");
  if (!cta) return;
  const onScroll = () => cta.classList.toggle("show", window.scrollY > 600);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
};

const initIntro = () => {
  const intro = document.getElementById("intro");
  const video = document.getElementById("introVideo");
  const skipBtn = document.getElementById("introSkip");
  const soundBtn = document.getElementById("introSound");
  const soundIcon = document.getElementById("introSoundIcon");
  const soundLabel = document.getElementById("introSoundLabel");
  const bar = document.getElementById("introBar");
  const timeEl = document.getElementById("introTime");
  if (!intro || !video || !skipBtn) return;

  let dismissed = false;
  const setSoundUI = (muted) => {
    if (soundIcon) soundIcon.textContent = muted ? "🔇" : "🔊";
    if (soundLabel) soundLabel.textContent = muted ? "Sunet OFF" : "Sunet ON";
  };
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    const hero = document.getElementById("heroChant");
    if (hero instanceof HTMLVideoElement) {
      try {
        hero.muted = video.muted;
        hero.currentTime = video.currentTime || 0;
        hero.play().catch(() => {});
      } catch {
        // The preview should never get stuck because hand-off failed.
      }
    }
    video.pause();
    intro.classList.add("hidden");
    document.body.style.overflow = "";
    setTimeout(() => intro.remove(), 700);
  };

  document.body.style.overflow = "hidden";
  video.muted = false;
  video.volume = 0.85;
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.then === "function") {
    playAttempt
      .then(() => setSoundUI(false))
      .catch(() => {
        video.muted = true;
        setSoundUI(true);
        video.play().catch(() => {});
      });
  } else {
    setSoundUI(video.muted);
  }

  soundBtn?.addEventListener("click", event => {
    event.stopPropagation();
    video.muted = !video.muted;
    if (!video.muted) video.play().catch(() => {});
    setSoundUI(video.muted);
  });
  skipBtn.addEventListener("click", dismiss);
  window.addEventListener("keydown", event => {
    if (event.key !== "Escape" && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    dismiss();
  });
  video.addEventListener("ended", dismiss);
  video.addEventListener("error", dismiss);
  video.addEventListener("timeupdate", () => {
    if (!video.duration || !Number.isFinite(video.duration)) return;
    if (bar) bar.style.width = `${Math.min(100, (video.currentTime / video.duration) * 100)}%`;
    if (timeEl) timeEl.textContent = `${Math.max(0, Math.ceil(video.duration - video.currentTime))}s`;
  });
  setTimeout(() => {
    if (video.currentTime < 0.2) dismiss();
  }, 12000);
};

const initHeroSound = () => {
  const video = document.getElementById("heroChant");
  const btn = document.getElementById("soundToggle");
  const icon = document.getElementById("soundIcon");
  const label = document.getElementById("soundLabel");
  if (!(video instanceof HTMLVideoElement) || !btn) return;
  const setUI = (muted) => {
    if (icon) icon.textContent = muted ? "🔇" : "🔊";
    if (label) label.textContent = muted ? "Activează sunetul" : "Oprește sunetul";
    btn.setAttribute("aria-label", muted ? "Activează sunetul" : "Oprește sunetul");
  };
  video.muted = false;
  video.volume = 0.7;
  video.play().catch(() => {
    video.muted = true;
    setUI(true);
    video.play().catch(() => {});
  }).then(() => setUI(video.muted));
  const onFirstGesture = () => {
    if (!video.muted) return;
    video.muted = false;
    video.play().catch(() => {});
    setUI(false);
    window.removeEventListener("pointerdown", onFirstGesture);
    window.removeEventListener("keydown", onFirstGesture);
  };
  window.addEventListener("pointerdown", onFirstGesture);
  window.addEventListener("keydown", onFirstGesture);
  btn.addEventListener("click", event => {
    event.stopPropagation();
    video.muted = !video.muted;
    if (!video.muted) video.play().catch(() => {});
    setUI(video.muted);
  });
};

const initLetterReveal = () => {
  const isGradientAncestor = (node) => {
    let parent = node.parentElement;
    while (parent) {
      if (
        parent.classList.contains("text-gradient-cyan") ||
        parent.classList.contains("text-gradient-gold")
      ) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  };

  document.querySelectorAll(".letter-reveal").forEach(root => {
    let i = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
      const text = node.nodeValue ?? "";
      if (!text.trim()) return;
      if (isGradientAncestor(node)) {
        const parent = node.parentElement;
        if (parent && !parent.dataset.lrApplied) {
          parent.dataset.lrApplied = "1";
          parent.style.opacity = "0";
          parent.style.transform = "translateY(0.6em)";
          parent.style.animation = `letterRise 0.9s cubic-bezier(0.16,1,0.3,1) ${0.4 + i * 0.035}s forwards`;
          i += text.trim().length;
        }
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const token of text.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          fragment.appendChild(document.createTextNode(token));
          continue;
        }
        const word = document.createElement("span");
        word.style.display = "inline-block";
        word.style.whiteSpace = "nowrap";
        for (const ch of token) {
          const span = document.createElement("span");
          span.textContent = ch;
          span.style.animationDelay = `${i * 0.035}s`;
          word.appendChild(span);
          i += 1;
        }
        fragment.appendChild(word);
      }
      node.parentNode?.replaceChild(fragment, node);
    });
  });
};

const initTrainerCarousel = () => {
  const root = document.getElementById("trainerSwiper");
  const wrapper = root?.querySelector(".swiper-wrapper");
  const slides = Array.from(root?.querySelectorAll(".swiper-slide") ?? []);
  const current = document.getElementById("trainerCurrent");
  const total = document.getElementById("trainerTotal");
  const pagination = document.querySelector(".swiper-pagination");
  if (!root || !wrapper || slides.length === 0) return;

  let index = 0;
  let startX = 0;
  if (total) total.textContent = String(slides.length).padStart(2, "0");
  const bullets = slides.map((_, i) => {
    const bullet = document.createElement("button");
    bullet.type = "button";
    bullet.className = "swiper-pagination-bullet";
    bullet.setAttribute("aria-label", `Mergi la antrenorul ${i + 1}`);
    bullet.addEventListener("click", () => goTo(i));
    pagination?.appendChild(bullet);
    return bullet;
  });

  const updateVideos = () => {
    slides.forEach(slide => {
      const active = slide.classList.contains("swiper-slide-active") ||
        slide.classList.contains("swiper-slide-next") ||
        slide.classList.contains("swiper-slide-prev");
      slide.querySelectorAll("video").forEach(video => {
        if (!(video instanceof HTMLVideoElement)) return;
        if (active) video.play().catch(() => {});
        else video.pause();
      });
    });
  };

  const update = () => {
    slides.forEach((slide, i) => {
      slide.classList.toggle("swiper-slide-active", i === index);
      slide.classList.toggle("swiper-slide-prev", i === (index - 1 + slides.length) % slides.length);
      slide.classList.toggle("swiper-slide-next", i === (index + 1) % slides.length);
    });
    bullets.forEach((bullet, i) => {
      bullet.classList.toggle("swiper-pagination-bullet-active", i === index);
      bullet.setAttribute("aria-current", i === index ? "true" : "false");
    });
    if (current) current.textContent = String(index + 1).padStart(2, "0");
    const active = slides[index];
    const max = Math.max(0, wrapper.scrollWidth - root.clientWidth);
    const centered = active.offsetLeft + active.offsetWidth / 2 - root.clientWidth / 2;
    wrapper.style.transform = `translate3d(${-Math.min(max, Math.max(0, centered))}px,0,0)`;
    updateVideos();
  };

  const goTo = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    update();
  };
  const step = (direction) => goTo(index + direction);

  document.getElementById("trainerNext")?.addEventListener("click", event => {
    event.preventDefault();
    step(1);
  });
  document.getElementById("trainerPrev")?.addEventListener("click", event => {
    event.preventDefault();
    step(-1);
  });
  document.addEventListener("keydown", event => {
    const rect = document.getElementById("trainers")?.getBoundingClientRect();
    const inView = rect && rect.top < window.innerHeight * 0.85 && rect.bottom > window.innerHeight * 0.15;
    if (!inView) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  });
  root.addEventListener("touchstart", event => {
    startX = event.touches[0]?.clientX ?? 0;
  }, { passive: true });
  root.addEventListener("touchend", event => {
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const dx = startX - endX;
    if (Math.abs(dx) > 45) step(dx > 0 ? 1 : -1);
  }, { passive: true });
  window.addEventListener("resize", update);
  update();
};

const initHyperLoop = () => {
  const targets = ["hyperBall", "hyperLine1", "hyperLine2", "hyperSub", "hyperBadge"]
    .map(id => document.getElementById(id))
    .filter(Boolean);
  targets.forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = i === 0 ? "scale(0.5)" : "translateY(30px)";
    el.style.animation = `letterRise 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 0.18}s forwards`;
  });
};

ready(() => {
  revealOnScroll();
  countStats();
  initFloatingCta();
  initIntro();
  initHeroSound();
  initLetterReveal();
  initTrainerCarousel();
  initHyperLoop();
});
