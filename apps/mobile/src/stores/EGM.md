# stores

## Overview

Client-side state stores built with Zustand.

## Interface

- `useAuthStore`: a hook created with Zustand `create<AuthState>`.
  - State:
    - `session: Session | null`
    - `user: User | null`
    - `initialized: boolean`
  - Actions:
    - `setSession(session)`
    - `setInitialized(value)`
    - `reset()`
  - `Session` and `User` are types from `@supabase/supabase-js`.

## Invariants

- The initial state is `session: null`, `user: null`, `initialized: false`.
- `setSession` sets `user` to `session?.user ?? null` in the same update, so `user` always follows `session`.
- `reset()` clears `session` and `user` but leaves `initialized` unchanged.
- The store lives in memory only; it uses no `persist` middleware. Session persistence happens in the Supabase client (`lib/supabase`).

## Side Effects

- None outside in-memory state.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
