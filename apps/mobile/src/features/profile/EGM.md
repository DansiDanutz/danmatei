# features/profile

## Overview

A thin REST client for the current user's profile. It is built on `api` from `lib/api.ts`.

## Interface

- `profileService.me()`: `GET /api/profile`, returns `Profile`.
- `profileService.update(input: Partial<Profile>)`: `PUT /api/profile`, returns `Profile`.
- `Profile` comes from `@/types/profile`.

## Invariants

- No server handler for `GET /api/profile` or `PUT /api/profile` exists in this repo (`api/` has no `profile.ts` or `profile/`), so these calls have no backend here.
- `update` sends any `Partial<Profile>`, including `id`, `role` and `email`. The client does not restrict which fields can be sent, so whichever server implements this route must enforce field permissions.
- Responses are cast to the generic type. Nothing validates them at runtime.

## Side Effects

- Sends HTTP requests to `config.apiBaseUrl` through `api`, with the Supabase bearer token when a session exists.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
