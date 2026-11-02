# Școala de Fotbal Dan Matei Blueprint

## System Overview

The web platform for the Școala de Fotbal Dan Matei youth football academy (see [README.md](./README.md)). One codebase serves the public site and the signed-in areas for parents, trainers and owners. It is made of:

- **Web SPA** (`client/`): Vite + React 19, built into `dist/public` (`vite.config.ts` `build.outDir`). The browser talks to Supabase directly for anything inside RLS scope.
- **Serverless API** (`api/`): Vercel functions at `/api/*` for everything that needs the Supabase service-role key, fan-out notifications, or third-party services (ElevenLabs, WhatsApp, an OpenAI-compatible LLM, Web Push), plus seven cron jobs.
- **Database** (`supabase/`): one Supabase project; all domain data lives in the `fotbal` schema, protected by RLS.
- **Production host** (`server/`): an Express server that serves `dist/public` with an `index.html` fallback. On Vercel, `vercel.json` serves the static build and rewrites non-`/api` paths to `/index.html`.
- **Mobile app** (`apps/mobile`): an Expo app in the pnpm workspace that uses Supabase Auth and calls the REST API at `EXPO_PUBLIC_API_BASE_URL`.

```
browser (client/) ──► Supabase (fotbal schema, RLS)
      │
      └──────────────► /api/* (Vercel functions) ──► Supabase (service role)
                                                 ├─► ElevenLabs, WhatsApp, LLM, Web Push
Vercel Cron ──────────► /api/cron/*
mobile (apps/mobile) ─► Supabase Auth, EXPO_PUBLIC_API_BASE_URL/api/*
```

## Local Interface & Invariants

The repository root holds only build, test and deploy configuration.

- **`vite.config.ts`**
  - `root` is `client/` and `envDir` is the repo root. Aliases: `@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets` (that directory does not exist in the repo).
  - Build inputs are `client/index.html` and `client/mobile-preview.html`, written to `dist/public` (`emptyOutDir`).
  - The dev server listens on `PORT` or 3030.
  - The dev server does **not** run `api/` functions. It proxies `/api` to `VITE_API_PROXY`, or to the deployed production origin when that variable is unset, so local `/api` calls hit production data by default (`vite.config.ts` `server.proxy`).
  - When `NODE_ENV=production`, the dev-only plugins `jsxLocPlugin` and `vitePluginManusRuntime` are dropped. The `manus-debug-collector` plugin is always in the plugin list; in production only its script-tag injection is skipped. In development the dev server appends browser logs under `.manus-logs/` and trims each file once it passes 1 MB.
  - The build-only `appVersionPlugin` writes `version.json`. `APP_VERSION` is the first 7 characters of `VERCEL_GIT_COMMIT_SHA`, else `git rev-parse --short HEAD`, else `dev-${Date.now()}`. It is also exposed to the app as the `__APP_VERSION__` global through `define`.
- **`vitest.config.ts`**: runs `tests/**/*.test.ts` in a Node environment.
- **Playwright configs**
  - `playwright.config.ts` runs `e2e/` against `http://localhost:3030` and starts `pnpm dev`. It skips the audit and role-smoke specs.
  - `playwright.audit.config.ts` runs the `full-audit`, `interaction-audit` and `preview-audit` specs and starts `pnpm dev` (`pnpm test:e2e:audit`).
  - `playwright.roles.config.ts` runs `role-smoke.spec.ts` and starts `scripts/start-vite-local-supabase.sh` (`pnpm test:e2e:roles`).
  - `playwright.cta.config.ts`, `playwright.full-audit.config.ts` and `playwright.interaction-audit.config.ts` each run one spec. They set no `baseURL` and no `webServer`, and no `package.json` script runs them. The full-audit and interaction-audit specs also run under `playwright.audit.config.ts`.
- **`vercel.json`**
  - `buildCommand` is `pnpm audit:production && pnpm check && pnpm build`, so a deploy fails if the dependency audit or any type or env check fails.
  - `api/**/*.ts` runs on `@vercel/node@5.1.10`.
  - Security headers (CSP, HSTS, `X-Frame-Options: DENY`) apply to all routes. `/assets/*` is cached immutably for a year; `/index.html` is revalidated on every request.
- **`docker-compose.yml`**: runs the self-hosted `evolution-api` WhatsApp gateway on host port 8081. It sets `WEBHOOK_GLOBAL_URL` to `{API_BASE}/api/whatsapp/inbound`, but `WEBHOOK_GLOBAL_ENABLED` is `"false"`, and no `api/whatsapp/inbound` handler exists in this repo (`api/whatsapp/` holds only `send-welcome.ts`). The optional `caddy` reverse proxy runs only under the `public` profile.
- **`package.json`**
  - Node `22.x`, `pnpm@10.34.5`. Patched dependencies `wouter@3.7.1` and `image-size@1.2.1` live in `patches/`; a `pnpm.overrides` block pins many transitive dependency versions.
  - Scripts: `dev`, `build` (`vite build`, then esbuild bundles `server/index.ts` into `dist/`), `start` (`NODE_ENV=production node dist/index.js`), `preview`, `check` (`check:env`, `check:app`, `check:api`, `check:mobile`), `format`, `test`, `test:watch`, `test:e2e`, `test:e2e:audit`, `test:e2e:roles`, `audit:production` and `audit:all`.
- **TypeScript configs**: `tsconfig.json` type-checks `client/src`, `shared` and `server` (`pnpm check:app`); `tsconfig.api.json` type-checks `api/**/*.ts` (`pnpm check:api`). `tsconfig.node.json` covers only `vite.config.ts`, and no script runs it.

## Subdirectories & System Boundaries

- **api**: [./api/EGM.md](./api/EGM.md) - Vercel serverless functions over the `fotbal` schema: service-role writes, notification fan-out, lead and voice-call workflow, AI drafts, Web Push, and 7 `CRON_SECRET`-guarded cron jobs.
- **apps**: [./apps/EGM.md](./apps/EGM.md) - pnpm workspace apps; currently only the Expo mobile app `@danmatei/mobile`.
- **client**: [./client/EGM.md](./client/EGM.md) - Vite root of the React SPA: routes and role guards, public marketing pages, parent, trainer and owner dashboards, and the static web root (service worker, manifest).
- **packages**: [./packages/EGM.md](./packages/EGM.md) - shared workspace packages; currently only the React Native UI kit `@danmatei/ui`, used by `apps/mobile`.
- **scripts**: [./scripts/EGM.md](./scripts/EGM.md) - dev and CI scripts: the env-example check (`pnpm check:env`), the production dependency audit (`pnpm audit:production`), ElevenLabs agent setup, and media and icon generation.
- **server**: [./server/EGM.md](./server/EGM.md) - the Express production host for the built SPA; no API routes.
- **shared**: [./shared/EGM.md](./shared/EGM.md) - constants and date-of-birth helpers imported by both `client/` and `api/`.
- **supabase**: [./supabase/EGM.md](./supabase/EGM.md) - the Supabase CLI project: config, seed data, ordered `fotbal` schema migrations, and RLS tests.

Directories without a contract (no production source code):

- `e2e/`: Playwright specs.
- `tests/`: Vitest unit tests (`tests/api`, `tests/lib`, and `tests/mobile-release-gate.test.ts`).
- `docs/`: project documentation.
- `patches/`: pnpm dependency patches.
- `services/`: ElevenLabs agent config (`services/elevenlabs-agent`) and the Caddyfile (`services/caddy`).

## Global Invariants

- The Supabase service-role key (`SUPABASE_SERVICE_ROLE`) is read only in `api/_lib/supabase.ts`. The browser and the mobile app use the anon key and stay inside RLS.
- All domain tables live in the `fotbal` schema, and RLS is enabled on every one of them (`supabase/migrations`).
- In production and preview, cron routes and webhook handlers reject requests (fail closed) when their secret (`CRON_SECRET`, webhook HMAC secrets) is unset.
- `LEAD_LINK_SIGNING_SECRET` is enforced only when `NODE_ENV` or `VERCEL_ENV` is `production` (`api/_lib/sign-token.ts:isProd`). Otherwise a missing secret falls back to a dev-only constant and `isLeadLinkSigningConfigured()` returns true.
- `api/` rate limits are kept in memory per function instance, not shared across instances.
- Every env var used in `api/`, `client/`, `server/`, `services/`, `docker-compose.yml` or `services/caddy/Caddyfile` must be documented in `.env.example`; `pnpm check:env` fails otherwise. `DEV`, `NODE_ENV`, `PORT` and `VERCEL_ENV` are exempt (`scripts/check-env-example.mjs`).
- pnpm is the only package manager (`packageManager` in `package.json`; the root `.gitignore` excludes `package-lock.json`).

## Global Side Effects

- **Supabase:** the `fotbal` schema, Auth, the storage buckets `fotbal-media-private`, `fotbal-trainer-public` and `fotbal-news-public`, and realtime publications.
- **External services:** ElevenLabs Conversational AI, WhatsApp (Meta Graph API and the self-hosted Evolution API, outbound only), an OpenAI-compatible chat-completions endpoint, and Web Push via VAPID.
- **Vercel Cron:** 7 schedules call `/api/cron/*` in production (`vercel.json` `crons`).
- **Local dev:** `/api` calls go to production unless `VITE_API_PROXY` is set.

## System Verification

- Run: `pnpm check` (env-example check plus `tsc` for the app, the API and the mobile app)
- Run: `pnpm test` (Vitest unit tests)
- Run: `pnpm test:e2e` (Playwright, starts `pnpm dev`)
- Run: `supabase db start && supabase test db` (RLS tests on a fresh local database; also run in CI by `.github/workflows/verify.yml`)
