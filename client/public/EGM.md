# public

## Overview

Static web root served by Vite (`root: client/`) and copied into the build output. It contains:

- a pre-bundle boot script that detects Supabase invite/recovery links
- a pass-through PWA service worker that also handles Web Push
- the PWA manifest
- SEO files
- binary media: trainer/founder videos and posters, hero videos, logos and icons

## Interface

- `boot.js`: a self-invoking script loaded as a classic `<script src="/boot.js">` in `client/index.html`, before the module bundle [boot.js]
- `sw.js`: service worker, registered by `client/src/main.tsx` with scope `/`
  - Push payload contract: `{ title, body, tag?, url? }` [sw.js:push listener]
- `manifest.webmanifest`:
  - name "Dan Matei — Școala de Fotbal"; display `standalone`; `start_url` / `scope` `/`
  - theme colour `#08091a`; lang `ro`
  - icons under `/icons/` [manifest.webmanifest]
- `robots.txt`: disallows `/admin`, `/antrenor`, `/copil/`, `/dashboard`, `/completeaza-profil` and `/inregistrare/copil` [robots.txt]
- `sitemap.xml`: 13 public URLs on `https://www.danmatei.ro` [sitemap.xml]
- Media used by the app:
  - `TheBoss.mp4`, `Kely.mp4`, `Sopi.mp4`, each with a `-poster.jpg`
  - `hero-chant.mp4`, `football-hero.mp4`, `logo-official.jpg`, `team-photo.jpg`
  - `black-white.png` and `football-player.jpg` [client/src/pages/Apel.tsx; client/src/pages/Programare.tsx]

## Invariants

- `boot.js` sets its flag only when the URL hash matches `[#&]type=(invite|recovery)` and swallows all errors. It is an external file so the CSP can stay `script-src 'self'` [boot.js]
- `sw.js` never calls `respondWith` and caches nothing. Its fetch handler exists only so Chromium treats the app as installable [sw.js:fetch listener]
- `sw.js` always shows a notification on push. The fallback title is "Academia Dan Matei" and the default URL is `/`. If the push body is not valid JSON, the raw text (`event.data.text()`) becomes the notification body [sw.js:push listener]

## Side Effects

- sessionStorage `pw-setup-pending = "1"`: read by `PasswordSetupRedirect` in `client/src/App.tsx` and cleared by `client/src/pages/SeteazaParola.tsx` [boot.js]
- `sw.js` lifecycle:
  - `skipWaiting()` on install
  - `clients.claim()` on activate
  - `showNotification` on push, with icon and badge `/icons/icon-192.png`, `tag` from the payload and `data.url` set to the target URL
  - on `notificationclick`, closes the notification, then focuses the first open window whose URL contains the target URL (`client.url.includes(target)`), or opens a new window on the target URL if none matches. With the default target `/`, any open window matches [sw.js:notificationclick listener]

## Verification

- Run: `pnpm test` (no test targets this directory; these files are not type-checked by `pnpm check:app`)
- E2E: `pnpm test:e2e`
