# features/profile

## Overview

A thin REST client for the current user's profile. It is built on `api` from `lib/api.ts`.

## Interface

- `profileService.me()`: `GET /api/profile`, returns `Profile`.
- `profileService.update(input: { fullName: string })`: `PUT /api/profile`, returns `Profile`.
- `Profile` comes from `@/types/profile`.

## Invariants

- The routes are served by `api/profile.ts` (see [api](../../../../../api/EGM.md)). `GET` returns the caller's own profile, with the email taken from Supabase Auth.
- `update` can send only `fullName` as far as the type goes. The server accepts only `fullName` (trimmed, 2 to 120 characters): any other key, such as `id`, `role` or `email`, rejects the whole request with 400 `forbidden_fields`, and a bad name returns 400 `invalid_body`. The type is not a runtime guard, so the server check is what enforces this.
- Responses are cast to the generic type. Nothing validates them at runtime.

## Side Effects

- Sends HTTP requests to `config.apiBaseUrl` through `api`, with the Supabase bearer token when a session exists.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
