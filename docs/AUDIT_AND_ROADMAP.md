# Audit & Roadmap — Școala de Fotbal Dan Matei

A pragmatic audit of the current state and a prioritized list of enhancements, with a focus on what would make the app feel uniquely **ours** (not a generic Expo template).

## Current state — what exists

### Web (`/` on `danmatei.vercel.app`)
- Vite + React 19 + Express + Supabase + wouter
- Public landing flow (`/`, `/cunoaste`) with the trainer reveal carousel built on Embla
- Auth (login, register, forgot, complete-profil)
- Trainer/Parent areas: `Antrenor`, `Dashboard`, `Notificari`, `Galerie`, `Stiri`, `Turnee`, `Campionat`
- Real assets: `hero-chant.mp4`, `football-hero.mp4`, `Kely.mp4`, `Sopi.mp4`, `TheBoss.mp4`, `team-photo.jpg`, `logo-official.jpg`, plus chant audio stems
- Real data in `client/src/data/landing.ts`: 3 trainers, 5 age groups (U7→U15), founder quote, stats

### Mobile preview (`/mobile-preview.html`)
- Static visual mock of 7 mobile screens: onboarding × 3, auth × 3, tabs (home, trainers, groups, chat, profile) × 5
- Intro splash with `hero-chant.mp4` + skip
- Hyperframes hero (animated GSAP composition)
- Trainer carousel (Swiper, dim/scale inactive slides, nav, keyboard, mousewheel)

### Mobile app scaffold (`apps/mobile`)
- Expo Router + TypeScript strict
- Stack: Supabase, TanStack Query, Zustand, NativeWind, RHF + Zod
- Routes scaffolded for onboarding, auth, tabs (home/chat/profile)
- Hyperframes composition for build-time MP4 rendering
- **Not yet wired to real data** — the screens use stubs

## What's missing

| Area | Gap |
| --- | --- |
| Player profiles | Players exist in `landing.ts` types but no UI screen, no roster view, no per-player profile |
| Match calendar | No fixtures, results, opponents, kick-off times |
| Training calendar | No actual schedule view per group (web has the data, mobile doesn't render it) |
| Attendance | No tracking, no streaks, no parent visibility |
| Photos | `Galerie` exists on web but no mobile gallery, no per-training photos |
| Lead capture / family onboarding | The journey from "interested parent" → "registered family" is manual |
| Video review / highlight clips | Trainer videos exist but no per-child or per-match clip system |
| Matchday mode | No live ticker, no formation, no in-app score updates |
| Multi-child support | Schema implies one profile per child but no UX for parent with 2+ kids |
| Push notifications | Library installed, no real triggers |
| Payments / membership | No fee tracking, no monthly invoice |
| Trainer dashboard | No coach-side workflow (mark attendance, write match notes, send broadcasts) |

## Priority enhancements

### 🔴 P0 — Foundational, build first
1. **Lead-capture → AI-call → trainer routing** (see [AI_CALL_FLOW.md](./AI_CALL_FLOW.md))
2. **Player profiles**
   - List view (per group)
   - Detail page: photo, position, year of birth, attendance %, recent highlights, parent contact
   - "Add child photo" flow for parents (Supabase Storage)
3. **Real schedule view** — pull `AGE_GROUPS[].schedule` into a calendar tab; integrate match fixtures
4. **Push notifications wired up** — at minimum: training cancellations, match reminders, trainer messages

### 🟡 P1 — Differentiators that make it feel unique
5. **AI-generated highlight clips** — already have hyperframes; per-child end-of-week reel rendered server-side from selected video clips + name overlay + chant audio
6. **Streak tracker + badges** — gamify attendance (10-training streak, perfect month, MVP voted by trainer)
7. **Match-day live mode** — landscape full-screen view: score, lineup, big "Goal!" button, optional voice notes from trainer to parents
8. **Voice notes** — trainer can record a 30-second voice memo → routed to all parents in the group + Boss
9. **Per-player skill tree** — passing, shooting, positioning, leadership (1–5 stars per skill, updated quarterly by trainer)
10. **Birthday celebrations** — auto-generated hyperframes video for each child's birthday with chant + name
11. **AR jersey try-on** — Expo + ViroReact, parents preview the academy kit on their child via camera
12. **Father/Son matchday tickets** — generate a shareable QR + animated card for special game days

### 🟢 P2 — Polish, animations, micro-interactions
13. **Page transitions** — `expo-router` shared element transitions between trainer card → trainer detail
14. **Pull-to-refresh** — custom football-spin Lottie instead of default spinner
15. **Stat counter animations** — count from 0 → 240 on first scroll into view (already in preview, port to app)
16. **Stagger animations** — group cards fade-in with 60ms stagger using Reanimated
17. **Confetti on milestone** — react-native-confetti-cannon when child unlocks a badge
18. **Haptic feedback** — Expo Haptics on tab change, button press, swipe milestone
19. **Skeleton loaders** — shimmer placeholders instead of spinners
20. **Parallax on hero** — trainer hero video parallax on scroll

### 🔵 P3 — Nice-to-have / late phase
21. **Equipment store** — order training kit, photo book, etc.
22. **Season recap video** — auto-edited end-of-year highlight from all match footage per child
23. **Tournament bracket UI**
24. **Coach dashboard web app** — separate route at `/antrenor` with attendance, match notes, broadcast tools
25. **Multi-language** — Hungarian (Cluj has a large Hungarian-speaking minority)

## Player profile design (P0 #2)

Where the most "uniqueness" can be added quickly:

```
┌─────────────────────────────┐
│  [hero photo / video clip]  │  ← parent-uploaded photo + kid-spec poster
│                             │
│  LUCA POP        ⭐⭐⭐⭐    │  ← name + skill stars
│  Atacant · 2020 · U7        │
│                             │
│  STREAK · 12 antrenamente   │  ← gamified attendance
│  ───────────────────────    │
│                             │
│  ULTIMUL MECI               │
│   ⚽ 2 goluri · 1 assist     │
│  ───────────────────────    │
│                             │
│  [Skill tree]               │
│  Pasare       ████░         │
│  Conducere    █████         │
│  Tehnică      ███░░         │
│  Cooperare    ████░         │
│  ───────────────────────    │
│                             │
│  [Highlight reels]          │
│  ▶ Săpt. 18  ▶ Cupa Toamnei │
│  ───────────────────────    │
│                             │
│  Antrenor: Sopi             │  ← link to trainer page
│  Părinte: Andrei P.         │
└─────────────────────────────┘
```

Per-child highlight reels are a perfect place to use **hyperframes**: the build pipeline generates a personalized 6-second clip per child each weekend (their best moment + name overlay + chant audio), parents share to TikTok/Insta.

## Animation palette

| Where | What | Library |
| --- | --- | --- |
| Tab change | 120ms scale + opacity fade-in | Reanimated |
| Card list mount | 60ms stagger fade-up | Reanimated layout animations |
| Number stats | Count-up on viewport-enter | `react-native-animateable-text` or custom |
| Trainer hero | Parallax video translate on scroll | Reanimated `useScrollOffset` |
| Onboarding swipe | Active dot grows + glow | already in preview, mirror in app |
| Match win | Confetti + chant audio sting | `react-native-confetti-cannon` + `expo-av` |
| Pull-to-refresh | Custom Lottie football spin | `lottie-react-native` |
| Achievement unlock | Bottom sheet + scale-in card + haptic | `@gorhom/bottom-sheet` + `expo-haptics` |
| Skill tree fill | Width-to-stars 800ms ease-out | Reanimated |

## Open questions for product

- **Multi-child families** — common at this academy?
- **Dual-language** — should everything be available in Hungarian too?
- **Privacy** — are children's photos public-facing or strictly opt-in per parent?
- **Live streaming** — is broadcasting Saturday matches in scope, or photos only?
- **Payments** — does the academy already use a system (Stripe? bank transfer?), or is this greenfield?
