# server

## Overview

Minimal Express host that serves the built Vite SPA in production. It has no API routes. `pnpm build` bundles `server/index.ts` with esbuild into `dist/index.js`, and `pnpm start` runs it with `NODE_ENV=production`. `pnpm dev` does not use it (`vite --host`).

## Interface

- `index.ts:startServer` (internal, invoked at module load; no exports).
- `express.static(staticPath)`, plus `GET *` returning `index.html` (SPA fallback).
- Env: `NODE_ENV` selects `staticPath`: `production` gives `<bundle dir>/public`, otherwise `../dist/public`. `PORT` defaults to `3000`.

## Invariants

- Every GET that does not match a static file returns `index.html`; no server-side routes or APIs exist here.
- ESM module: `__dirname` is derived from `fileURLToPath(import.meta.url)`.

## Side Effects

- Opens an HTTP server (`http.createServer(app).listen(port)`) on import and logs `Server running on http://localhost:${port}/`.
- Reads static files from disk under `staticPath`.
- Startup errors are logged via `console.error`; the process is not exited explicitly.

## Verification

- `pnpm build && pnpm start`
- `pnpm test`
