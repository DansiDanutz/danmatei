# lib

## Overview

Core infrastructure for the mobile app:

- `config.ts` reads configuration from environment variables.
- `supabase.ts` creates the Supabase client, which stores the session in AsyncStorage.
- `api.ts` is a fetch-based JSON API client. It sends the Supabase access token as a bearer token.

## Interface

- `config` (`config.ts`, `as const`): `{ supabaseUrl, supabaseAnonKey, apiBaseUrl }`, plus the type `AppConfig = typeof config`.
- `supabase` (`supabase.ts`): the result of `createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`.
- `api` (`api.ts`): `get<T>(path, options?)`, `post<T>(path, body?, options?)`, `put<T>(path, body?, options?)` and `del<T>(path, options?)`. All four go through the private `request<T>`.
- `ApiError` (`api.ts`): extends `Error` and adds `status: number` and `body?: unknown`. Its `name` is `"ApiError"`.

## Invariants

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_API_BASE_URL` are required. If any is missing or empty, `required()` throws `Missing env var <NAME>. Add it to your .env file (see .env.example).`
- `apiBaseUrl` is `required(EXPO_PUBLIC_API_BASE_URL)`: a missing or empty value throws at import, like the Supabase vars. Beyond being non-empty, the value is not validated as a URL.
- The request URL is `${config.apiBaseUrl}${path}`.
- `request` always sends `Content-Type: application/json`. It adds `Authorization: Bearer <access_token>` only when `supabase.auth.getSession()` returns a session.
- A body that is not `undefined` is sent as `JSON.stringify(body)`.
- How a response is read:
  - An empty response body becomes `undefined`.
  - Text that is not valid JSON is returned as a string (`safeJson`).
- When a response is not OK, `request` throws `ApiError(message, status, body)`. `message` is `body.message` if the body is an object with a `message` key; otherwise it is `Request failed with status <status>`.
- A successful response body is cast to `T` with no runtime validation.

## Side Effects

- Importing `config.ts` evaluates the env vars right away, so a missing required variable throws at import time.
- `supabase.ts` imports `react-native-url-polyfill/auto`, which patches `URL` globally. It also creates the client when the module loads.
- The Supabase client reads and writes the auth session in AsyncStorage and refreshes tokens automatically.
- Each `api` call runs `supabase.auth.getSession()` and then sends a network `fetch` to `config.apiBaseUrl`.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
