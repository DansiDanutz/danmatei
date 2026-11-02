# client

## Overview

Vite root of the main Dan Matei football academy SPA (React 19, wouter, Tailwind v4, Supabase). The two HTML entry points live here:

- `index.html` loads `/boot.js` and then `/src/main.tsx`.
- `mobile-preview.html` loads `/src/mobile-preview.js`.

The browser talks to Supabase directly for anything within RLS scope. It calls the Vercel `/api/*` functions for operations that need the service role, ElevenLabs or WhatsApp.

## Subdirectories & Boundaries

- src: [./src/EGM.md](./src/EGM.md) - The SPA itself:
  - `App.tsx` defines routes and guards (`RequireAuth`, `RequireRole`, `PublicOnly`) and nests the providers.
  - `pages/` holds public, auth, parent, trainer and owner screens.
  - `components/` holds shells, feature panels and UI primitives.
  - `lib/` holds the Supabase client (schema `fotbal`), auth, and the push and realtime hooks.
- public: [./public/EGM.md](./public/EGM.md) - Static web root:
  - `boot.js` sets sessionStorage `pw-setup-pending` when an invite or recovery link is opened.
  - `sw.js` is a pass-through service worker that also handles Web Push.
  - Also holds the PWA manifest, `robots.txt`, `sitemap.xml` and media.
- __manus__: [./__manus__/EGM.md](./__manus__/EGM.md) - Dev-only debug collector, injected by a Vite plugin. It patches console, fetch and XHR and POSTs the captured logs to `/__manus__/logs`.
