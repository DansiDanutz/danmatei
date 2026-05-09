# Mobile Architecture

Cross-platform mobile app for **Școala de Fotbal Dan Matei**, built with Expo + React Native + TypeScript and sharing a Supabase backend with the web app.

## Repo layout (monorepo)

```
danmatei/
├─ apps/
│  └─ mobile/              # Expo Router app (iOS / Android / Web)
│     ├─ app/              # File-based routes
│     ├─ src/              # Feature modules, lib, stores, hooks, types
│     ├─ hyperframes/      # Build-time HTML video compositions
│     └─ assets/           # Rendered videos, images, fonts
├─ packages/
│  └─ ui/                  # Shared cross-platform UI primitives (@danmatei/ui)
├─ docs/
└─ <web app at root>       # Vite + React + Express (deployed to Vercel)
```

The web app remains at the repository root for now; converting it to `apps/web/` is a follow-up that requires flipping Vercel's "Root Directory" project setting.

## App layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routes | `app/` | Expo Router screens. Thin — composition only, no business logic. |
| Reusable UI | `packages/ui/`, `src/components/ui` | Pure presentation. No hooks beyond local state. |
| Feature modules | `src/features/<name>/` | Domain logic — services, schemas, queries, slices. |
| Data access | `src/lib/api.ts`, `src/lib/supabase.ts` | The **only** places that talk to the network. |
| Local state | `src/stores/` | Zustand stores for cross-feature client state. |
| Server state | `@tanstack/react-query` | All async data fetching/mutations. |
| Config | `src/lib/config.ts` | Environment variable validation. |

## Routing

Expo Router uses the `app/` directory:

```
app/
├─ _layout.tsx              # Root providers (QueryClient, SafeArea, GestureHandler)
├─ index.tsx                # Auth gate → /tabs/home or /onboarding
├─ onboarding/index.tsx
├─ auth/{login,register,forgot-password}.tsx
└─ tabs/
   ├─ _layout.tsx           # Bottom tab bar
   ├─ home.tsx
   ├─ chat.tsx
   └─ profile.tsx
```

## Auth flow

1. `_layout.tsx` mounts `useSession()`, which subscribes to `supabase.auth.onAuthStateChange` and writes to a Zustand store.
2. `app/index.tsx` redirects based on session presence.
3. `app/auth/*` calls `authService` (signIn, signUp, resetPassword) — all logic lives in `src/features/auth/`.
4. Tokens are forwarded automatically by `src/lib/api.ts` for any custom backend calls (`/api/*`).

## Hyperframes integration (build-time)

`apps/mobile/hyperframes/<name>/` holds HTML compositions rendered to MP4 with the `hyperframes` CLI. Output lands in `apps/mobile/assets/`. The onboarding screen plays/displays the rendered hero. Add new compositions with `pnpm dlx hyperframes init <name>` and a `render:<name>` script in `apps/mobile/package.json`.

## Theming

NativeWind v4 + Tailwind tokens in `apps/mobile/tailwind.config.js`. Brand palette is `brand.{50,500,600,900}`; surface tokens cover both light and dark. `useColorScheme()` toggles `class`-based dark mode.

## Environment

See `apps/mobile/.env.example`. Required:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL` (defaults to the production API)

## What's not wired yet

- `assets/onboarding-hero.mp4` — render via `pnpm render:hero` once Chrome is installed (`hyperframes browser install`).
- Push notifications (expo-notifications).
- Deep links beyond `danmatei://`.
- `/api/profile`, `/api/chat/*` endpoints — the mobile app calls these but the web `api/` directory does not implement them yet.
