/**
 * PlayerKickAnimation — self-contained 5-second SVG animation of a player
 * dribbling, then striking a ball. No external video file needed.
 *
 * Used as the visual hero on the landing card (Home.tsx) before the
 * 5s redirect to /cunoaste. Honors prefers-reduced-motion: skips the
 * kick keyframes but still presents a static composed scene.
 *
 * Drawing is split into:
 *   - sky / pitch gradient backdrop with parallax stripes
 *   - player silhouette built from primitives (head, torso, arms, legs)
 *   - ball with rotation + path arc
 *   - dust + speed lines on impact
 *   - branded corner accents
 *
 * The whole composition fits an aspect ratio of 4/3 (matches Home.tsx).
 */
import { motion, useReducedMotion } from "framer-motion";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function PlayerKickAnimation() {
  const reduce = useReducedMotion();

  return (
    <div className="relative h-full w-full overflow-hidden bg-[oklch(0.10_0.025_250)]">
      {/* Pitch backdrop with horizon */}
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.15 0.04 250)" />
            <stop offset="50%" stopColor="oklch(0.18 0.05 240)" />
            <stop offset="100%" stopColor="oklch(0.10 0.025 250)" />
          </linearGradient>
          <linearGradient id="pitch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.22 0.06 160 / 0.55)" />
            <stop offset="100%" stopColor="oklch(0.12 0.04 200 / 0.85)" />
          </linearGradient>
          <radialGradient id="spot" cx="50%" cy="60%" r="60%">
            <stop offset="0%" stopColor="oklch(0.75 0.12 230 / 0.18)" />
            <stop offset="100%" stopColor="oklch(0.75 0.12 230 / 0)" />
          </radialGradient>
          <linearGradient id="cyanLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.75 0.12 230 / 0)" />
            <stop offset="50%" stopColor="oklch(0.75 0.12 230 / 0.7)" />
            <stop offset="100%" stopColor="oklch(0.75 0.12 230 / 0)" />
          </linearGradient>
        </defs>

        {/* Sky */}
        <rect width="400" height="180" fill="url(#sky)" />
        {/* Pitch */}
        <rect y="160" width="400" height="140" fill="url(#pitch)" />
        {/* Spotlight glow */}
        <rect width="400" height="300" fill="url(#spot)" />
        {/* Horizon line */}
        <line
          x1="0"
          y1="180"
          x2="400"
          y2="180"
          stroke="url(#cyanLine)"
          strokeWidth="1"
        />
      </svg>

      {/* Pitch stripes (parallax) */}
      <motion.svg
        viewBox="0 0 400 140"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 h-[47%] w-full"
        aria-hidden="true"
        initial={{ x: 0 }}
        animate={reduce ? undefined : { x: [-10, 10, -10] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={i * 70 - 30}
            y={0}
            width={35}
            height={140}
            fill="oklch(1 0 0 / 0.018)"
          />
        ))}
      </motion.svg>

      {/* Distant crowd silhouette */}
      <svg
        viewBox="0 0 400 60"
        preserveAspectRatio="none"
        className="absolute left-0 top-[42%] h-[10%] w-full opacity-40"
        aria-hidden="true"
      >
        <path
          d="M0,60 L0,30 Q20,20 40,32 T80,30 T120,28 T160,32 T200,26 T240,30 T280,28 T320,32 T360,30 T400,32 L400,60 Z"
          fill="oklch(0.20 0.04 240)"
        />
      </svg>

      {/* Goal posts (far) */}
      <svg
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid meet"
        className="absolute right-[6%] top-[28%] h-[28%] w-[30%] opacity-40"
        aria-hidden="true"
      >
        <line
          x1="60"
          y1="40"
          x2="60"
          y2="170"
          stroke="oklch(0.85 0.02 250 / 0.7)"
          strokeWidth="2.5"
        />
        <line
          x1="320"
          y1="40"
          x2="320"
          y2="170"
          stroke="oklch(0.85 0.02 250 / 0.7)"
          strokeWidth="2.5"
        />
        <line
          x1="60"
          y1="40"
          x2="320"
          y2="40"
          stroke="oklch(0.85 0.02 250 / 0.7)"
          strokeWidth="2.5"
        />
        {/* Net hint */}
        {Array.from({ length: 7 }).map((_, i) => (
          <line
            key={i}
            x1={60 + (i + 1) * 32}
            y1="40"
            x2={60 + (i + 1) * 32}
            y2="170"
            stroke="oklch(0.85 0.02 250 / 0.18)"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Player + ball animated layer */}
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Player shadow */}
        <motion.ellipse
          cx="120"
          cy="248"
          rx="28"
          ry="4"
          fill="oklch(0 0 0 / 0.5)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, rx: reduce ? 28 : [28, 22, 28] }}
          transition={{
            opacity: { duration: 0.8, delay: 0.2 },
            rx: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
          }}
        />

        {/* Player group — slight bob + lean before kick */}
        <motion.g
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: expoOut }}
        >
          <motion.g
            animate={
              reduce
                ? undefined
                : {
                    rotate: [0, -2, 0, 2, -4, 0],
                  }
            }
            transition={{
              duration: 2.4,
              ease: "easeInOut",
              times: [0, 0.2, 0.45, 0.6, 0.78, 1],
            }}
            style={{ transformOrigin: "120px 240px" }}
          >
            {/* Standing leg (planted) */}
            <path
              d="M118 200 L114 244"
              stroke="oklch(0.20 0.05 250)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            {/* Boot — planted */}
            <ellipse
              cx="112"
              cy="246"
              rx="8"
              ry="3"
              fill="oklch(0.10 0.02 250)"
            />

            {/* Kicking leg — animates from back-swing to follow-through */}
            <motion.g
              style={{ transformOrigin: "120px 200px" }}
              animate={
                reduce
                  ? undefined
                  : {
                      rotate: [-30, -55, -30, 35, 60, 20],
                    }
              }
              transition={{
                duration: 2.4,
                ease: "easeInOut",
                times: [0, 0.2, 0.4, 0.62, 0.72, 1],
              }}
            >
              <path
                d="M120 200 L138 240"
                stroke="oklch(0.22 0.05 250)"
                strokeWidth="9"
                strokeLinecap="round"
              />
              {/* Boot — kicking */}
              <ellipse
                cx="140"
                cy="244"
                rx="9"
                ry="3.5"
                fill="oklch(0.75 0.12 230)"
                stroke="oklch(0.95 0.01 250 / 0.5)"
                strokeWidth="0.6"
              />
            </motion.g>

            {/* Shorts */}
            <path
              d="M104 188 L136 188 L138 210 L102 210 Z"
              fill="oklch(0.20 0.06 220)"
            />

            {/* Jersey — equipment cyan */}
            <path
              d="M96 150 L144 150 L150 188 L90 188 Z"
              fill="oklch(0.75 0.12 230)"
            />
            {/* Jersey number */}
            <text
              x="120"
              y="176"
              textAnchor="middle"
              fontFamily="Oswald, sans-serif"
              fontSize="14"
              fontWeight="700"
              fill="oklch(0.10 0.02 250)"
            >
              10
            </text>
            {/* Collar */}
            <path
              d="M114 150 Q120 156 126 150"
              fill="none"
              stroke="oklch(0.20 0.06 220)"
              strokeWidth="2"
            />

            {/* Arms */}
            <motion.path
              d="M96 156 L80 188"
              stroke="oklch(0.85 0.02 250)"
              strokeWidth="6"
              strokeLinecap="round"
              animate={reduce ? undefined : { rotate: [0, -10, 0, 10, 0] }}
              transition={{ duration: 2.4, ease: "easeInOut" }}
              style={{ transformOrigin: "96px 156px" }}
            />
            <motion.path
              d="M144 156 L160 192"
              stroke="oklch(0.85 0.02 250)"
              strokeWidth="6"
              strokeLinecap="round"
              animate={reduce ? undefined : { rotate: [0, 12, 0, -8, 0] }}
              transition={{ duration: 2.4, ease: "easeInOut" }}
              style={{ transformOrigin: "144px 156px" }}
            />

            {/* Head */}
            <circle cx="120" cy="138" r="11" fill="oklch(0.78 0.04 60)" />
            {/* Hair */}
            <path
              d="M110 134 Q120 122 130 134 L130 138 Q120 130 110 138 Z"
              fill="oklch(0.18 0.02 50)"
            />
          </motion.g>
        </motion.g>

        {/* Ball — dribble bounce, then arcs forward toward goal at ~1.5s */}
        <motion.g
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={
            reduce
              ? { opacity: 1 }
              : {
                  opacity: 1,
                  x: [0, -6, 0, 4, 120, 200, 240],
                  y: [0, -10, 0, -8, -40, -10, -2],
                }
          }
          transition={{
            duration: 2.4,
            times: [0, 0.12, 0.25, 0.5, 0.7, 0.88, 1],
            ease: ["easeOut", "easeIn", "easeOut", "easeOut", "easeIn", "easeOut"],
            delay: 0.2,
          }}
        >
          {/* Ball shadow */}
          <motion.ellipse
            cx="156"
            cy="252"
            rx="7"
            ry="2"
            fill="oklch(0 0 0 / 0.45)"
            animate={reduce ? undefined : { opacity: [0.4, 0.2, 0.4, 0.5, 0.1, 0.3, 0.4] }}
            transition={{ duration: 2.4, ease: "easeInOut" }}
          />
          <motion.g
            style={{ transformOrigin: "156px 244px" }}
            animate={reduce ? undefined : { rotate: [0, -360, -720, -1080] }}
            transition={{ duration: 2.4, ease: "linear" }}
          >
            <circle
              cx="156"
              cy="244"
              r="9"
              fill="oklch(0.97 0.01 250)"
              stroke="oklch(0.20 0.05 250)"
              strokeWidth="0.6"
            />
            {/* Pentagon panels */}
            <path
              d="M156 238 L161 242 L159 248 L153 248 L151 242 Z"
              fill="oklch(0.15 0.04 250)"
            />
            <path
              d="M150 240 L148 244 L150 248"
              fill="none"
              stroke="oklch(0.15 0.04 250)"
              strokeWidth="0.8"
            />
            <path
              d="M162 240 L164 244 L162 248"
              fill="none"
              stroke="oklch(0.15 0.04 250)"
              strokeWidth="0.8"
            />
          </motion.g>
        </motion.g>

        {/* Speed lines on impact */}
        {!reduce &&
          [0, 1, 2, 3].map((i) => (
            <motion.line
              key={i}
              x1={170 + i * 14}
              y1={210 + i * 4}
              x2={210 + i * 14}
              y2={210 + i * 4}
              stroke="oklch(0.75 0.12 230 / 0.55)"
              strokeWidth="1.2"
              strokeLinecap="round"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: [0, 1, 0], x: [-20, 30, 60] }}
              transition={{
                duration: 0.6,
                delay: 1.55 + i * 0.05,
                ease: "easeOut",
              }}
            />
          ))}

        {/* Dust on kick */}
        {!reduce &&
          [0, 1, 2, 3, 4].map((i) => (
            <motion.circle
              key={i}
              cx={146 + i * 4}
              cy={252 - i * 1.5}
              r={1.6 + (i % 2)}
              fill="oklch(0.85 0.02 250 / 0.6)"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 0.7, 0], y: [-4 - i, -16 - i * 2] }}
              transition={{
                duration: 0.9,
                delay: 1.5 + i * 0.04,
                ease: "easeOut",
              }}
            />
          ))}
      </svg>

      {/* Branded corner accents */}
      {[
        "top-3 left-3 border-l-2 border-t-2",
        "top-3 right-3 border-r-2 border-t-2",
        "bottom-3 left-3 border-l-2 border-b-2",
        "bottom-3 right-3 border-r-2 border-b-2",
      ].map((cls, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className={`absolute size-5 rounded-sm border-brand-cyan/30 ${cls}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 + i * 0.07, ease: expoOut }}
        />
      ))}

      {/* Top + bottom vignettes for depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[oklch(0.10_0.025_250)] via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[oklch(0.08_0.02_250)]/40 via-transparent to-transparent" />

      {/* Motto */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-[6%] z-20 text-center"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6, ease: expoOut }}
      >
        <motion.span
          className="font-heading text-[9px] uppercase tracking-[0.3em] text-white/45 sm:text-[10px]"
          animate={reduce ? undefined : { opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          Work Hard · Feel Good
        </motion.span>
      </motion.div>
    </div>
  );
}
