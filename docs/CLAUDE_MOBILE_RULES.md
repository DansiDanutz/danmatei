# Claude Mobile Rules

Rules Claude (or any contributor) must follow when working in `apps/mobile/`. These are enforced by review, not tooling.

1. **TypeScript strict, always.** Don't relax `strict`/`noUncheckedIndexedAccess` to silence errors.
2. **No business logic in screens.** Screens (`app/**`) compose components and call feature services. If a screen file grows past ~150 lines, extract.
3. **All API access via `src/lib/api.ts`.** No raw `fetch` outside that module. No direct `supabase` calls outside `src/lib/supabase.ts` and `src/features/auth/`.
4. **Auth lives in `src/features/auth`.** Don't import `supabase.auth` from a screen — go through `authService` / `useSession`.
5. **Reusable UI must come from `@danmatei/ui` first.** Only build feature-local components when no primitive fits.
6. **Loading, empty, error.** Every async UI must render all three states. A bare `ActivityIndicator` is not enough — empty needs copy and error needs a retry path.
7. **Safe-area on every screen.** Use `<Screen>` from `@danmatei/ui` or `SafeAreaView` directly.
8. **Forms use React Hook Form + Zod.** Schema in `features/<name>/schemas.ts`; resolver passed to `useForm`.
9. **Server state → TanStack Query. Client state → Zustand.** Don't store remote data in Zustand; don't store ephemeral form state in Query.
10. **No secrets in source.** Read from `process.env.EXPO_PUBLIC_*` via `src/lib/config.ts`. Update `.env.example` whenever you add a new variable.
11. **Don't mutate the web app's `client/`, `api/`, `server/`, or `shared/` from mobile changes.** The web app stays intact.
    - **Exception (recorded 2026-11-02):** the profile and chat routes in [`docs/designs/mobile-profile-and-chat-backend.md`](designs/mobile-profile-and-chat-backend.md) ship in the same PR as their mobile changes. That PR may add new files under `api/` (the routes), add the migration and tests under `supabase/`, and change `api/_lib/supabase.ts` (add `getAuthUser`; `getUserIdFromJwt` delegates to it). Nothing else under `client/`, `api/`, `server/` or `shared/` may change in it.
    - **Exception (recorded 2026-11-02):** CORS for those same routes, so Expo Web can call them. It changes `api/_lib/mobile-api.ts` only (`applyCors` and `allowedWebOrigins`, called from `mobileRoute`), plus its test and the `MOBILE_WEB_ORIGINS` entry in `.env.example`. It does not touch any other `api/` route, `vercel.json` or the web app.
12. **One concern per PR.** Mobile scaffolding, hyperframes compositions, and feature work go in separate PRs when possible.

## Definition of done for a mobile feature

- New routes registered under `app/`.
- Feature module under `src/features/<name>/` with at least: `service.ts` (or `queries.ts`), `schemas.ts` if it has forms, types in `src/types/`.
- Loading + empty + error states implemented.
- Works on iOS, Android, and Web (`pnpm --filter @danmatei/mobile web`).
  - The Profile and Chat tabs call `/api/profile` and `/api/chat/*`, which answer the browser's preflight and send CORS headers only for allowed origins: `http://localhost:8081`, `http://localhost:19006` and the comma-separated `MOBILE_WEB_ORIGINS` server variable. A deployed Web build must have its exact origin in `MOBILE_WEB_ORIGINS`, set on the server (Vercel), or its API calls are blocked by the browser. The other `/api` routes still send no CORS headers.
- `pnpm --filter @danmatei/mobile check` passes.
- Updated `.env.example` if new env vars were added.
