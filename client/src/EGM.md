# src

## Overview

Source root of the SPA (Vite alias `@`):

- `main.tsx` mounts `<App/>` and registers the service worker.
- `App.tsx` nests the providers, declares every wouter route along with its guard, and decides whether each route loads eagerly or lazily.
- `mobile-preview.js` is a standalone vanilla-DOM script for `client/mobile-preview.html`.

## Interface

- **`App`** (default export) [App.tsx:App]
  - Provider nesting: `ErrorBoundary` > `ThemeProvider(defaultTheme="dark", switchable)` > `AuthProvider` > `TooltipProvider`
  - Rendered inside the providers: `Toaster`, `Router`, `PasswordSetupRedirect`, `FloatingProgramareCTA`, `UpdatePrompt`
- **Routes** [App.tsx:Router]
  - Public, no guard: `/`, `/cunoaste`, `/academie`, `/grupe`, `/turnee`, `/campionat`, `/stiri`, `/notificari`, `/rezultate`, `/copii`, `/program`, `/galerie`, `/contact`, `/programare`, `/apel/:token`
  - Password setup, no guard by design: `/seteaza-parola` and its alias `/set-password`
  - `PublicOnly`: `/login`, `/inregistrare`
  - `RequireAuth`: `/dashboard`, `/completeaza-profil`, `/inregistrare/copil`, `/copil/:childId`
  - `RequireRole`:
    - `/antrenor`: `trainer`, `owner`, `super_admin`
    - `/admin`: `owner`, `super_admin`
  - Not found: `/404`, plus a final catch-all route that also renders `NotFound`
  - Eagerly loaded: `Home`, `Cunoaste`, `Login`, `Inregistrare`, `SeteazaParola`, `NotFound`
  - Every other page loads through `React.lazy`, with a `BrandSpinner` as the suspense fallback
- **`main.tsx`**
  - `createRoot(#root).render(<App/>)`
  - Loaded by `client/index.html` after `/boot.js`
- **`const.ts`**: re-exports `COOKIE_NAME` and `ONE_YEAR_MS` from `@shared/const`
- **`app-version.d.ts`**: declares the global `__APP_VERSION__`, whose value comes from the `vite.config.ts` `define`
- **`mobile-preview.js`**: runs the effects for `client/mobile-preview.html`
  - scroll reveals and stat counters
  - floating CTA: toggles `.show` on `#ctaPill` while `scrollY > 600` [mobile-preview.js:initFloatingCta]
  - per-letter title reveal [mobile-preview.js:initLetterReveal]
  - intro video and hero sound
  - trainer carousel and hyper-loop animation
- **Subdirectories**
  - [components](./components/EGM.md): shells, route guards, and feature components
  - [contexts](./contexts/EGM.md): `ThemeProvider` / `useTheme`
  - [data](./data/EGM.md): static landing content (`OWNER`, `TRAINERS`, `AGE_GROUPS`)
  - [hooks](./hooks/EGM.md): `useComposition`, `useCountUp`, `useIsMobile`, `usePersistFn`
  - [lib](./lib/EGM.md): Supabase client, auth, domain helpers, push/realtime hooks
  - [pages](./pages/EGM.md): route-level screens

## Invariants

- `PasswordSetupRedirect` sends any user with a session and `sessionStorage['pw-setup-pending'] === '1'` to `/seteaza-parola`, unless they are already there or on `/set-password`. It only reads the flag and never clears it [App.tsx:PasswordSetupRedirect]
- wouter `Switch` renders the first route that matches, and unmatched paths fall through to the final `NotFound` route
- On lazy protected routes, the guard wraps the `Suspense` boundary [App.tsx:Router]
- `mobile-preview.js` dismisses the intro only once: on skip, on Escape/Enter/Space, or when the intro video ends or errors. After 12s it dismisses the intro only if playback has stalled (`video.currentTime < 0.2`) [mobile-preview.js:initIntro]
- When reduced motion is on, or `IntersectionObserver` is missing, all reveal elements are shown immediately. Otherwise a 4000 ms fallback timer reveals every remaining reveal element even if it never entered the viewport [mobile-preview.js:revealOnScroll]

## Side Effects

- Registers `/sw.js` with scope `/` on window `load`. A registration failure only logs a warning [main.tsx]
- Reads sessionStorage `pw-setup-pending` [App.tsx:PasswordSetupRedirect]
- `mobile-preview.js` runs DOM effects:
  - plays and unmutes video/audio
  - adds keydown, scroll, touch, resize and `pointerdown` listeners (the first `pointerdown` or keydown unmutes the hero video) [mobile-preview.js:initHeroSound]
  - sets `document.body.style.overflow = "hidden"` while the intro is shown and clears it on dismiss [mobile-preview.js:initIntro]
  - splits text into per-letter spans
  - runs `requestAnimationFrame` counters

## Verification

- Run: `pnpm test` (Vitest over `tests/**/*.test.ts`)
- Type-check: `pnpm check:app` (`tsc --noEmit`; `tsconfig.json` includes `client/src/**/*`)
- E2E: `pnpm test:e2e`
