# apps

## Overview

The pnpm workspace applications (`apps/*` in `pnpm-workspace.yaml`). Right now this contains only the Expo mobile app. The web SPA lives outside the workspace, in `/client`, `/server` and `/api`.

## Subdirectories & Boundaries

- mobile: [./mobile/EGM.md](./mobile/EGM.md) - `@danmatei/mobile`, the Expo Router app built with NativeWind, Supabase Auth, React Query and Zustand. It uses the shared UI from `@danmatei/ui` and calls the REST endpoints `/api/profile` and `/api/chat/threads...` with a Supabase bearer token. No handler for these endpoints exists in this repo's `api/`. Check it with `pnpm --filter @danmatei/mobile check`.
