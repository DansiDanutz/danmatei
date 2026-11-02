# scripts

## Overview

Standalone developer and CI utility scripts (Node `.mjs`, Bash, Python). Two are wired to root `package.json` scripts (`check-env-example.mjs`, `verify-production-dependencies.mjs`); `start-vite-local-supabase.sh` is the `webServer.command` in `playwright.roles.config.ts`; the rest are run by hand. Scripts resolve paths relative to the repo root (run them from there). `chant-stems/` holds WAV assets used only by `build-chant.sh`.

## Interface

| Script | Invocation | Purpose |
| --- | --- | --- |
| `check-env-example.mjs` | `pnpm check:env` | Scans `api`, `client`, `server`, `services` (+ `docker-compose.yml`, `services/caddy/Caddyfile`) for env var names and checks each is documented in `.env.example` |
| `verify-production-dependencies.mjs` | `pnpm audit:production` / `pnpm audit:all` (`--all`) | Runs `pnpm audit [--prod] --json` and fails on non-allowlisted advisories |
| `elevenlabs-agent.mjs` | `node scripts/elevenlabs-agent.mjs [--dry-run]` | Creates/updates the ElevenLabs interview agent from `services/elevenlabs-agent/agent.json` + `prompt.ro.md` and wires its post-call webhook. Exports `buildAgentBody(dir)` |
| `build-chant.sh` | `./scripts/build-chant.sh <source-video.mp4>` | ffmpeg mix of `chant-stems/*.wav` under the video's audio into `client/public/hero-chant.mp4` |
| `generate-icons.py` | `python scripts/generate-icons.py` | Pillow-based PWA icon generation from `client/public/logo-official.jpg` |
| `start-vite-local-supabase.sh` | `./scripts/start-vite-local-supabase.sh` | Exports `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_API_PROXY` from `supabase status -o env`, then `exec pnpm dev -- --host 127.0.0.1 --strictPort` |

Env vars read: `elevenlabs-agent.mjs` reads `ELEVENLABS_API_KEY`, `ELEVENLABS_POST_CALL_WEBHOOK_ID`, `ELEVENLABS_INTERVIEW_AGENT_ID`, `ELEVENLABS_POST_CALL_WEBHOOK_URL` (default `https://www.danmatei.ro/api/voice/elevenlabs-webhook`); `start-vite-local-supabase.sh` honors an existing `VITE_API_PROXY` (default `http://127.0.0.1:9`).

## Invariants

- `check-env-example.mjs` exits 1 if any used env var (except `IGNORE` = `DEV`, `NODE_ENV`, `PORT`, `VERCEL_ENV`) is missing from `.env.example`, or if `.env.example` defines a name twice.
- `verify-production-dependencies.mjs`: without `--all` only `critical`/`high` advisories block; with `--all` every severity blocks. It exits 1 on empty/invalid JSON, or when the JSON parsed but `audit.error`, `audit.signal` or `report.error` is set, or the report is missing `advisories`/`metadata` (`verify-production-dependencies.mjs:13-41`). It spawns pnpm with `shell: true` on Windows only (line 10).
- `verify-production-dependencies.mjs:locallyMitigated` (GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr) are skipped only if the `image-size@1.2.1` patch from `pnpm.patchedDependencies` contains the expected guards. `toolchainOnly` advisories are skipped only when every finding path starts with an allowed prefix (lines 59-99): GHSA-86w9-cpqp-85rv, GHSA-vfj7-8cjw-p6xm, GHSA-3g3m-2fjr-6pw4 and GHSA-g3hv-75wg-m249 (`apps__mobile>expo>@expo/cli>`), GHSA-mrhx-c7xc-m3w5 (`apps__mobile>expo>@expo/cli>`, `.>hyperframes>`, `apps__mobile>hyperframes>`), GHSA-gcqx-w48m-w2h4 (`apps__mobile>expo>@expo/config>`), GHSA-hp3w-g68c-fv3c (`.>hyperframes>`, `apps__mobile>hyperframes>`), GHSA-vcc3-ghjq-m6fr and GHSA-qr28-fpjm-wq7f (`apps__mobile>expo-router>query-string>`), GHSA-rj75-hqrm-r3gf (`apps__mobile>tailwindcss>`, `apps__mobile>nativewind>`, `apps__mobile>react-native-css-interop>`).
- `elevenlabs-agent.mjs`: `--dry-run` prints the request body and makes no network calls or writes. Otherwise it requires `ELEVENLABS_API_KEY`, creates a webhook only if `ELEVENLABS_POST_CALL_WEBHOOK_ID` is unset, and PATCHes the agent if `ELEVENLABS_INTERVIEW_AGENT_ID` is set (else creates it). `main()` runs only when executed directly. It never prints the webhook secret.
- `build-chant.sh` and `start-vite-local-supabase.sh` run with `set -euo pipefail`. `build-chant.sh` requires exactly one existing video argument and all six stem files. In `start-vite-local-supabase.sh`, a failing `supabase status -o env` or a grep with no match is tolerated (`2>/dev/null ... || true`), so whenever `API_URL` or `PUBLISHABLE_KEY` is missing the script exits 1 with `Run supabase start first.` (lines 7-8).

## Side Effects

- `elevenlabs-agent.mjs`: HTTPS calls to `https://api.elevenlabs.io/v1` (`POST /workspace/webhooks`, `POST /convai/agents/create`, `PATCH /convai/agents/{id}`). It writes/merges `services/elevenlabs-agent/.output.local.json` (webhook id, webhook secret, agent id).
- `verify-production-dependencies.mjs`: spawns `pnpm audit` (registry network access); reads `package.json` and the patch file.
- `build-chant.sh`: spawns `ffmpeg`/`ffprobe`/`python3`, uses a `mktemp -d` dir removed on exit, and overwrites `client/public/hero-chant.mp4`.
- `generate-icons.py`: creates `client/public/icons/` and writes `icon-512.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon-32.png`, `icon-maskable-512.png`.
- `start-vite-local-supabase.sh`: runs `supabase status -o env` and replaces itself with the Vite dev server.
- `check-env-example.mjs`: read-only.

## Verification

- `pnpm check:env`
- `pnpm audit:production` / `pnpm audit:all`
- `pnpm test`
