# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`danmatei` is the web platform for Școala de Fotbal Dan Matei (a youth football academy in Cluj-Napoca). It serves three audiences from one codebase: parents tracking their children, trainers managing groups/results, and admins editing landing content and trainer rosters. It also includes an AI voice agent (ElevenLabs) and WhatsApp Business integration for lead capture and notifications.

The product is a Vite + React 19 SPA with an Express server for production hosting, a set of Vercel serverless functions under `/api`, and Supabase (Postgres + auth + storage + realtime) as the backend of record. Auth, UI, and routing run client-side; anything that needs the service-role key (RLS bypass, fan-outs, third-party integrations) lives in `/api`.

## Repository layout

This is a **pnpm workspace**. `pnpm-workspace.yaml` declares `apps/*` and `packages/*`, but several top-level dirs are intentionally outside the workspace:

- `client/` — main React SPA source. Vite `root` is set here (`vite.config.ts`); entry is `client/src/main.tsx` → `client/src/App.tsx`. Path alias `@` points here.
- `server/` — `server/index.ts`, the Express server used in production. In dev, Vite serves; `npm start` runs the bundled `dist/index.js`.
- `api/` — Vercel serverless functions (Node runtime). Anything that touches the service-role Supabase key, ElevenLabs, or WhatsApp belongs here. Subdirs: `_lib/` (helpers), `ai/` (ElevenLabs `start-conversation`, webhook), `voice/`, `lead/`, `whatsapp/`, plus `trainers.ts` and `notify.ts`.
- `shared/` — code imported from both client and api. Path alias `@shared`.
- `apps/mobile/` — React Native / Expo app (NativeWind, same brand identity).
- `packages/ui/` — shared UI primitives (Avatar, Button, Card, Input, Screen) consumed by `apps/mobile`.
- `services/voice-agent/` — standalone voice agent service.
- `supabase/` — migrations (`migrations/0001_init.sql`), seed, and temp files. Schema namespace is `fotbal` with 12 tables (profiles, trainers, children, news, schedule_events, match_results, match_participations, player_events, media, messages, notifications, landing_content) and 3 storage buckets (`fotbal-media-private`, `fotbal-trainer-public`, `fotbal-news-public`). `player_events` is append-only.
- `e2e/` — Playwright specs.
- `patches/` — pnpm patches; notably `wouter@3.7.1.patch` (custom routing). Patched deps and `nanoid@3.3.7` pin live in `package.json` under `pnpm.patchedDependencies` / `pnpm.overrides`.
- `docs/` — `AI_CALL_FLOW.md`, `AUDIT_AND_ROADMAP.md`, `CLAUDE_MOBILE_RULES.md`, `COMPONENT_GUIDE.md`, `MOBILE_ARCHITECTURE.md`.

## Architecture

### Routing and roles
`client/src/App.tsx` lazy-loads pages and wires three guards: `PublicOnly`, `RequireAuth`, `RequireRole`. Public marketing routes (`/cunoaste`, `/academie`, `/grupe`, `/turnee`, `/campionat`, `/stiri`, `/notificari`, `/rezultate`, …) live alongside auth routes (`/login`, `/inregistrare`) and authenticated routes (`/dashboard`, `/copil/:childId`, `/antrenor`, `/admin`). `/dashboard` is a role-based router that dispatches to parent / trainer / owner views.

### Frontend stack
React 19, Wouter for routing (with the local patch), React Hook Form + Zod for forms, Tailwind v4 for styling, Framer Motion for transitions, Radix UI primitives + shadcn-style wrappers (`new-york`, tsx, CSS variables; aliases `@/components`, `@/utils`, `@/ui`, `@/lib`, `@/hooks` per `components.json`). Charts via Recharts; toasts via Sonner.

### Backend boundary
- Browser → Supabase JS for everything inside RLS scope (auth, reads, writes the user owns).
- Browser → `/api/*` (Vercel functions) for anything that needs the service-role key: trainer creation, fan-out notifications, ElevenLabs agent calls, WhatsApp messaging, age-group rematching.
- Production: `server/index.ts` (Express) serves built static assets and falls back to `index.html` for client-side routes. In dev, Vite serves the SPA directly.

### Vite specifics (`vite.config.ts`)
- `root: client/`, output: `dist/public/`. Aliases: `@` → `client/src`, `@shared` → `shared`.
- Manual chunks for `vendor`, `motion`, `supabase`, `ui`.
- Custom Manus runtime plugin pipes browser logs to `.manus-logs/` for debugging.
- Dev port is **3030** (Playwright `baseURL` matches).

## Common commands

```bash
pnpm dev           # Vite dev server, port 3030 (--host so devices on LAN can connect)
pnpm build         # vite build, then esbuild server/index.ts → dist/index.js (ESM)
pnpm start         # NODE_ENV=production node dist/index.js
pnpm preview       # vite preview --host
pnpm check         # tsc --noEmit (strict)
pnpm format        # prettier --write .
```

### Tests (Playwright)
The full suite is `e2e/`. There is no `pnpm test` script — invoke Playwright directly.

```bash
pnpm exec playwright test                                  # all e2e specs
pnpm exec playwright test e2e/accessibility.spec.ts        # one file
pnpm exec playwright test -g "renders the hero"            # by test name
pnpm exec playwright test --config=playwright.audit.config.ts   # audit-only run (preview-audit.spec.ts)
```

The default config (`playwright.config.ts`) starts `pnpm dev` automatically, runs Chromium only, retries in CI, and emits an HTML report.

## Conventions

- Prettier: semicolons on, single quotes off, trailing commas `es5`, 80 cols, 2-space indent. Keep `pnpm format` clean before commit.
- TypeScript strict; module `ESNext`, resolution `bundler`. Path aliases: `@/*` → `client/src/*`, `@shared/*` → `shared/*`.
- Design tokens live in `DESIGN_SYSTEM.md`: cyan primary `#5ECBF2`, navy secondary `#1E4D5C`, gold accent `#D4A843`, dark bg `#0A1628`. Display font Oswald, body Source Sans 3. Card system uses `bg-surface`, `border-white/8`, `rounded-2xl`. Targets: 4.5:1 contrast, 44px touch targets, respect `prefers-reduced-motion`.
- pnpm-only — do not add `package-lock.json` or `yarn.lock`. If a dep needs patching, use `pnpm patch` and commit the patch file under `patches/`.
- Mobile-app rules are separate; consult `docs/CLAUDE_MOBILE_RULES.md` before touching `apps/mobile/`.

## Deployment and environment

`vercel.json` builds `dist/public` as the static SPA, runs `/api/**/*.ts` on Node 5.1.10 (sic — pinned in `vercel.json`), caches assets for one year (`immutable`) and bypasses cache for `index.html`, and rewrites all non-`/api` paths to `index.html`.

Required env (`.env.example`):
- Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`.
- Server / `/api`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`.
- ElevenLabs: `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`.
- WhatsApp Business: `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`.

## References

- `README.md` — stack, routes, local dev, Supabase setup, deploy.
- `DESIGN_SYSTEM.md` — colors, typography, spacing, animation, accessibility tokens.
- `docs/AI_CALL_FLOW.md` — ElevenLabs conversation architecture.
- `docs/COMPONENT_GUIDE.md` and `docs/MOBILE_ARCHITECTURE.md` — component and mobile-app patterns.
- `docs/AUDIT_AND_ROADMAP.md` — accessibility/feature roadmap.
