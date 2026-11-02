# lib

## Overview

Shared browser-side infrastructure:

- The Supabase client, configured for schema `fotbal`
- The auth context and roles
- Pure domain helpers: age and trainer matching, payment status tiers, championship tables, WhatsApp links, public-load timeout handling
- Hooks for app updates, browser notifications, lead realtime and Web Push

## Interface

- `supabase`, `FOTBAL_SCHEMA = "fotbal"`, `isSupabaseConfigured` [supabase.ts:supabase]
- `AuthProvider`, `useAuth(): AuthState` (throws outside the provider), `useRole()`; types `UserRole`, `Profile`, `AuthState`. `AuthState` includes `signIn`, `signUp`, `signInWithGoogle`, `signOut`, `refreshProfile` and `profileComplete` [auth.tsx:AuthProvider]
- `currentAge`, `ageGroupLabel`, `matchTrainers`, `formatTimelineDate`, `isBirthdayToday`; type `TrainerCandidate` [age.ts]
- `buildChampionshipGroups(seeds, rows): GroupBlock[]`; types `ChampionshipRow`, `GroupSeed`, `MatchRow`, `GroupBlock` [championship.ts:buildChampionshipGroups]
- `computePaymentStatus(charges, payments, now?)`, `statusLabel`, `statusColorClass`; types `PaymentStatus`, `ChargeSummary`, `PaymentSummary`, `StatusResult` [payment-status.ts:computePaymentStatus]
- `startPublicLoad(request, onState, timeoutMs = 6000)`; type `PublicLoadState` (`loading|failed|ready`) [public-load.ts:startPublicLoad]
- `fetchTrainerNames(): Promise<Map<string,string>>` [trainer-names.ts:fetchTrainerNames]
- `TRAINING_BASES`, `OTHER_LOCATION = "Altă locație"` [locations.ts]
- `buildWhatsAppLink(phone, message?)`, `defaultParentToTrainerGreeting(name)`, `formatRoPhone(phone)` [whatsapp.ts]
- `ELEVENLABS_AUDIO_ASSETS` (same-origin worklet URLs) [elevenlabs-audio.ts]
- Framer Motion presets [motion.ts]:
  - easings and springs: `expoOut`, `easeOut`, `springBounce`, `springSmooth`, `springSnappy`, and durations `dur`
  - variant factories: `fadeUp`, `fadeIn`, `scaleIn`, `slideInLeft`, `slideInRight`, `staggerContainer`, `staggerItem`
  - gestures: `hoverLift`, `hoverGlow`, `tapScale`
- `cn(...)` (clsx + tailwind-merge) [utils.ts:cn]
- Hooks:
  - `useAppUpdate()` [use-app-update.ts]
  - `useBrowserNotification()`; type `Permission` (`default|granted|denied|unsupported`) [use-browser-notification.ts]
  - `useLeadRealtime(trainerSlug, onNew)` [use-lead-realtime.ts]
  - `usePushSubscription()` [use-push-subscription.ts]

## Invariants

- `UserRole` is one of `owner | super_admin | trainer | parent` [auth.tsx:UserRole]
- `profileComplete` requires `phone.trim().length >= 8` [auth.tsx:profileComplete]
- A missing profile row is lazily upserted with role `parent` [auth.tsx:loadProfile]
- `signUp` sends user metadata `{ app: "fotbal", role: "parent", full_name, phone }` and sets `emailRedirectTo` to `VITE_APP_URL`, or the current origin when that is unset [auth.tsx:signUp]
- `signInWithGoogle(redirectTo?)` redirects to `${redirectTo ?? VITE_APP_URL ?? origin}/dashboard` and forces the account picker (`prompt: select_account`) [auth.tsx:signInWithGoogle]
- Payment tiers:
  - `outstanding = max(0, charged - paid)`; zero outstanding is `green`
  - Otherwise, take the oldest unpaid charge (FIFO by `due_date`) and count its calendar months overdue: 0 (due this month or later) = `green`, 1 = `yellow`, 2 = `orange`, 3 = `red`, 4 or more = `closed`
  - If no unpaid charge is found, the result is `green` with the non-zero `outstandingRon` kept [payment-status.ts:computePaymentStatus]
- Age group labels run `U6–U7` through `U14–U15`, then `Seniori`. Ages are computed in `Europe/Bucharest`. The header comment example `ageGroupLabel(7) → "U6–U7"` matches the code [age.ts:ageGroupLabel]
- `startPublicLoad` reports `failed` after the timeout. A late success replaces it with `ready`. Nothing is reported after cancel [public-load.ts]
- `buildWhatsAppLink` needs at least 9 digits, otherwise it returns `null` [whatsapp.ts]
- Lead realtime filters on `recipient_trainer_id=eq.<trainerSlug>`. `recipient_trainer_id` is a text column holding trainer slugs (e.g. `t-dan`; migrations 0026, 0029), so this compares slug to slug. Rows with `channel !== 'inapp'` are ignored [use-lead-realtime.ts]
- Push auto-subscribes only when permission is `granted` and the user has not opted out. A failed server-side subscribe rolls back the browser subscription [use-push-subscription.ts:subscribe]
- Browser notifications fire only when the document is not visible [use-browser-notification.ts:notify]
- Update polling runs only in production: first check after 4s, then every 5 min. It also checks on window `focus` and when the tab becomes visible. Checks are skipped while the tab is hidden [use-app-update.ts]
- When an update is pending and the tab becomes hidden, `useAppUpdate` reloads the page without asking [use-app-update.ts:onVisibility]
- `applyUpdate()` calls `serviceWorker.getRegistration()` and `update()` (errors ignored), then reloads [use-app-update.ts:applyUpdate]

## Side Effects

- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (with placeholder fallbacks and a warning), `VITE_APP_URL`
- localStorage keys: `scoala-fotbal-auth` (auth storage key), `push-opt-out`
- Supabase:
  - Auth API calls (password, Google OAuth, sign-out)
  - Upsert into `profiles`
  - A direct REST fetch of `profiles` with `Accept-Profile: fotbal`
  - RPC `public_trainer_names`
  - Realtime channel `lead-inbox:<slug>` (INSERT on `fotbal.lead_notifications`)
- HTTP: GET `/api/push/vapid-key`, POST `/api/push/subscribe`, POST `/api/push/unsubscribe`, GET `/version.json`
- Service worker and push APIs, the Notification API, `location.reload()` when an update is applied or when the tab is hidden with an update pending
- `useAppUpdate` adds a document `visibilitychange` listener and a window `focus` listener, removed on unmount

## Verification

- Run: `pnpm test`. Unit tests exist for this directory: `tests/lib/age.test.ts`, `tests/lib/championship.test.ts`, `tests/lib/public-load.test.ts`
- Targeted: `pnpm exec vitest run tests/lib`
- Type-check: `pnpm check:app`
