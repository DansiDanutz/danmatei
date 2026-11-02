# src

## Overview

Non-route source code for the Expo mobile app. Imports use the `@/*` path alias, which `tsconfig.json` maps to `./src/*`. The modules depend on each other like this:

- `features/chat` and `features/profile` -> `lib/api` -> `lib/supabase` -> `lib/config`
- `features/auth` -> `lib/supabase` directly (not through `lib/api`), and also writes to `stores/auth-store`.
- `features/onboarding` imports nothing from `lib`.

## Subdirectories & Boundaries

- constants: [./constants/EGM.md](./constants/EGM.md) - `colors` token object and the `ColorToken` type.
- features: [./features/EGM.md](./features/EGM.md) - domain modules: auth, chat, onboarding and profile.
- hooks: [./hooks/EGM.md](./hooks/EGM.md) - `useMounted` ref hook.
- lib: [./lib/EGM.md](./lib/EGM.md) - env `config` (throws at import if a required var is missing), the AsyncStorage-backed `supabase` client, and the `api` fetch client with `ApiError` (sends a bearer token).
- stores: [./stores/EGM.md](./stores/EGM.md) - `useAuthStore`, an in-memory Zustand store holding the session, user and `initialized` flag.
- types: [./types/EGM.md](./types/EGM.md) - `ChatThread`, `ChatMessage` and `Profile` types.
- utils: [./utils/EGM.md](./utils/EGM.md) - `formatRelativeDate` (default locale `ro-RO`) and `initials`.
