# components

## Overview

Shared React components for the SPA:

- Layout shells (public, member, auth)
- Route guards
- Legacy landing sections
- Hero media cards
- Chat
- Audio checks for the AI call
- PWA install and update prompts

Feature-specific panels live in the subdirectories listed below.

## Interface

- **Route guards** [RouteGuards.tsx]:
  - `RequireAuth({children})`: redirects to `/login` when there is no user
  - `RequireRole({roles, children})`: redirects to `/login` when there is no user, to `/completeaza-profil` when there is no profile, and to `/dashboard` when the role is not allowed
  - `PublicOnly({children})`: a logged-in user is sent to `/dashboard` via `window.location.replace`
- **Shells**:
  - `PublicShell` with props `{children, pageTitle?, pageKicker?, pageDescription?, hideFooter?}` (exported type `PublicShellProps`) [PublicShell.tsx:PublicShell]
  - `NavItem` type `{href, label, icon}` exported from PublicShell.tsx [PublicShell.tsx:NavItem]
  - `MemberShell` with props `{children, navLinks?}`; renders `NotificationBell`, `InstallAppButton` and `ThemeToggle` [MemberShell.tsx:MemberShell]
  - `AuthCardShell` with props `{eyebrow, title, subtitle?, children, footer?}` [AuthCardShell.tsx]
- **Mobile section nav** [MobileSectionNav.tsx]: `MobileSectionHome`, `MobileSectionHeader`, `sectionTriggerClass(tone)`, and the types `MobileSection<T>` and `SectionTone`
- **Chat**: `ChatThread` with props `{trainerId, childId, counterpartName?, className?}` (exported type `ChatThreadProps`); a realtime 1:1 parent–trainer thread [ChatThread.tsx:ChatThread]
- **Trainer AI**: `TrainerAIPanel` with props `{trainerId, initialWhatsapp, initialAgentId, onSaved?}` (exported type `TrainerAIPanelProps`); edits the trainer's WhatsApp number and ElevenLabs agent id, and lists `ai_conversations` [TrainerAIPanel.tsx]
- **Hero**:
  - `HeroTimer` with props `{children, redirectTo?='/cunoaste', disabled?}` [HeroTimer.tsx]
  - `HeroChantCard` with props `{src?, autoPlay?, loop?, skipTo?}` (exported type `HeroChantCardProps`) [HeroChantCard.tsx]
  - `HeroCard` and `Hero`
- **Audio checks**: `MicTest` and `SpeakerTest`, both with `{onResult?(heard)}`; used by `client/src/pages/Apel.tsx`
- **App chrome**: `ErrorBoundary`, `UpdatePrompt`, `InstallAppButton`, `FloatingProgramareCTA`, `ThemeToggle`, `GoogleAuthButton`, `LoadErrorState({what})`, `DemoBanner`, `ScrollProgress`, `SectionReveal` / `RevealItem`, `WhatsAppIcon`, `PaymentStatusInfo`
- **Legacy landing sections**: `About`, `CTA`, `Contact`, `Footer`, `Gallery`, `Navbar`, `Programs`, `Results`, `PlayerShowcase`, `PlayerKickAnimation`, `FloatingBall`. These use hardcoded content
- **Subdirectories**:
  - [admin](./admin/EGM.md): owner dashboard tabs
  - [cunoaste](./cunoaste/EGM.md): public swipe deck
  - [effects](./effects/EGM.md): confetti
  - [leads](./leads/EGM.md): lead form → `/api/lead/create`
  - [notifications](./notifications/EGM.md): header bell with realtime
  - [player](./player/EGM.md): child stats header and team matches
  - [trainer](./trainer/EGM.md): trainer dashboard tabs and lead inbox
  - [ui](./ui/EGM.md): shadcn primitives and brand primitives

## Invariants

- Every guard renders a loading shell while `useAuth().loading` is true. `RequireRole` renders its children only when there is a user, a profile, and `roles.includes(profile.role)` [RouteGuards.tsx]
- `ChatThread` [ChatThread.tsx]:
  - finds or creates one `parent_trainer` thread per `(trainer_id, child_id)`
  - loads at most 100 messages
  - deduplicates optimistic and realtime messages by id
  - does not send empty drafts
- `FloatingProgramareCTA` is hidden on `/apel`, `/login`, `/inregistrare` and `/programare`, and appears only after `scrollY > 600` [FloatingProgramareCTA.tsx:HIDDEN_ROUTES]
- `HeroTimer` is disabled by `?stay=1` or the `disabled` prop. Otherwise it redirects after `HERO_REDIRECT_MS` (from `client/src/data/landing.ts`), even when reduced motion is on [HeroTimer.tsx]
- `InstallAppButton` renders nothing when `useAuth().profile` is null (anonymous users, and signed-in users without a profile row) or when the app is already installed [InstallAppButton.tsx]
- `TrainerAIPanel` stores blank inputs as `null`. The `ai_conversations` list is limited to 50 rows [TrainerAIPanel.tsx:onSave, refresh]
- `PublicShell` desktop icons: the first click shows the label for `REVEAL_MS = 3000`; a second click navigates [PublicShell.tsx]

## Side Effects

- Supabase tables:
  - `chat_threads` (select and insert) and `chat_messages` (select and insert) [ChatThread.tsx]
  - `ai_conversations` (select) and `trainers` (update `whatsapp_number`, `elevenlabs_agent_id`) [TrainerAIPanel.tsx]
- Realtime channel `chat:${threadId}`: INSERT events on `fotbal.chat_messages`
- localStorage `dm-pwa-installed`: set to `"1"` on install, removed when `beforeinstallprompt` fires. Listens for `beforeinstallprompt` and `appinstalled`, and calls `getInstalledRelatedApps` [InstallAppButton.tsx]
- Media and audio:
  - plays `/hero-chant.mp4` and `/football-hero.mp4`
  - `getUserMedia` with an `AnalyserNode` [MicTest.tsx]
  - WebAudio chime [SpeakerTest.tsx]
- Navigation:
  - timed redirect [HeroTimer.tsx]
  - guard redirects [RouteGuards.tsx]
  - `window.location.reload()` [ErrorBoundary.tsx, LoadErrorState.tsx]
  - `mailto:` submit [Contact.tsx]
- `setInterval` every 200 ms that trims the ball's trail [FloatingBall.tsx]
- Window scroll listeners. `document.body.style.overflow` is locked while mobile menus are open [Navbar.tsx, PublicShell.tsx]
- External links: `tel:0744311147`, `wa.me/40744311147`, `mailto:zzizzou5@yahoo.com` [CTA.tsx, Contact.tsx, Footer.tsx], Facebook, Google Maps, and Unsplash images

## Verification

- Run: `pnpm test` (no unit test targets this directory directly)
- Type-check: `pnpm check:app`
- E2E: `pnpm test:e2e`
