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
12. **One concern per PR.** Mobile scaffolding, hyperframes compositions, and feature work go in separate PRs when possible.

## Definition of done for a mobile feature

- New routes registered under `app/`.
- Feature module under `src/features/<name>/` with at least: `service.ts` (or `queries.ts`), `schemas.ts` if it has forms, types in `src/types/`.
- Loading + empty + error states implemented.
- Works on iOS, Android, and Web (`pnpm --filter @danmatei/mobile web`).
- `pnpm --filter @danmatei/mobile check` passes.
- Updated `.env.example` if new env vars were added.
