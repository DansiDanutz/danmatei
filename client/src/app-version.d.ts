/**
 * Build-time app version, injected by the `app-version` Vite plugin in
 * vite.config.ts (see `define`). Equals the deploy's git commit (or a dev
 * timestamp). The update watcher compares it against /version.json to detect
 * when a newer build has shipped.
 */
declare const __APP_VERSION__: string;
