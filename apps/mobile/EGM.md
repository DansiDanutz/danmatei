# @danmatei/mobile

## Overview

The Expo / React Native app for Școala de Fotbal Dan Matei. It is a pnpm workspace package named `@danmatei/mobile` with entry `expo-router/entry`. The stack:

- routing: Expo Router (file-based routes in `app/`);
- styling: NativeWind / Tailwind;
- auth and session: Supabase;
- data fetching: React Query;
- forms: react-hook-form with zod;
- client state: Zustand.

Shared UI primitives come from the workspace package `@danmatei/ui` (`/packages/ui`). Read `/docs/CLAUDE_MOBILE_RULES.md` and `/docs/MOBILE_ARCHITECTURE.md` before changing this app.

## Interface

- Scripts (`package.json`):
  - `start`, `android`, `ios` and `web` run `expo start` with the matching platform flag.
  - `check` runs `tsc --noEmit`.
  - `render:hero` runs `hyperframes render ./hyperframes/onboarding-hero --output ./assets/onboarding-hero.mp4`.
- Expo config (`app.json`):
  - name "Dan Matei", slug `danmatei-mobile`, deep-link scheme `danmatei`, portrait only;
  - iOS bundle ID and Android package `com.danmatei.mobile`;
  - plugins `expo-router`, `expo-splash-screen` (background `#0b1020`) and `expo-font`;
  - `experiments.typedRoutes: true`;
  - web build uses Metro with `static` output.
- Path aliases (`tsconfig.json`): `@/*` maps to `./src/*`, and `@ui/*` maps to `../../packages/ui/*`.
- Environment variables (`.env.example`, typed in `expo-env.d.ts`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_API_BASE_URL`.
- Build config:
  - `babel.config.js`: `babel-preset-expo` with `jsxImportSource: "nativewind"`, plus `nativewind/babel` and `react-native-worklets/plugin`.
  - `metro.config.js`: wrapped in `withNativeWind` with input `./global.css`.
  - `tailwind.config.js`: preset `nativewind/preset`, `darkMode: "class"`, theme colors `brand`, `ink` and `surface`, `borderRadius` `xl` (16px), `2xl` (20px) and `3xl` (28px), and `fontFamily.sans` `["Inter", "system-ui", "sans-serif"]`. No file loads an `Inter` font, although the `expo-font` plugin is configured in `app.json`. Its content globs cover `app/`, `src/` and `../../packages/ui`.
  - `nativewind-env.d.ts`: references `nativewind/types`; included by `tsconfig.json`.
- Unused dependency: `package.json` declares `react-native-mmkv`, but nothing in `app/` or `src/` imports it. Session storage uses AsyncStorage.
- Subdirectories:
  - app: [./app/EGM.md](./app/EGM.md) - Expo Router route tree: root layout and providers, the session redirect, and the auth, onboarding and tab screens.
  - src: [./src/EGM.md](./src/EGM.md) - lib (config, Supabase, API client), feature services, the store, types, hooks and utils.
  - hyperframes: [./hyperframes/README.md](./hyperframes/README.md) - HyperFrames source for the onboarding hero video. It is not app runtime code.

## Invariants

- TypeScript runs with `strict: true` and `noUncheckedIndexedAccess: true`, and the config extends `expo/tsconfig.base`.
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_API_BASE_URL` must be set. `src/lib/config.ts` throws at import time if any of them is missing or empty.
- The Tailwind content globs include `../../packages/ui`, so class names used in shared UI components are compiled into the app's styles.
- The brand palette in this app (`brand.500` / `colors.brand` `#3b82f6`, `ink` `#0b1020`) is defined separately in `tailwind.config.js` and `src/constants/colors.ts`. It does not match the web `DESIGN_SYSTEM.md` tokens.

## Side Effects

- At runtime the app:
  - talks to Supabase Auth and keeps the session in AsyncStorage;
  - calls the REST API at `EXPO_PUBLIC_API_BASE_URL` (`/api/profile` and `/api/chat/threads...`) with a Supabase bearer token. No handler for these routes exists in this repo (`api/` has no `profile` or `chat/` entry), so they would return 404 against this repo's backend.
- `render:hero` writes `./assets/onboarding-hero.mp4`.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
