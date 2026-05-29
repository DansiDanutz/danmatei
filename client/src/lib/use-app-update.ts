/**
 * useAppUpdate — detects when a newer build has been deployed and lets the
 * user pull it in with one tap.
 *
 * The service worker is intentionally pass-through (no app-shell caching, see
 * client/public/sw.js), so a long-lived tab keeps running the bundle it first
 * loaded until a full reload. This hook closes that gap: it compares the build
 * stamped into the running app (`__APP_VERSION__`, injected by the app-version
 * Vite plugin) against the freshly-deployed `/version.json`, and flags when
 * they differ. `applyUpdate()` reloads to fetch the new index.html + assets.
 *
 * Polling runs only in production. In dev there is no /version.json, but a
 * `?__update_test=1` query param force-shows the prompt for previewing.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const VERSION_URL = "/version.json";
const POLL_MS = 5 * 60 * 1000; // re-check every 5 minutes
const CURRENT =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?_=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    // Dev server answers unknown paths with the SPA's index.html — ignore.
    if (!ct.includes("application/json")) return null;
    const data = (await res.json()) as { version?: string };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      // Preview the prompt locally without a real deploy.
      try {
        if (new URLSearchParams(window.location.search).has("__update_test")) {
          setUpdateReady(true);
        }
      } catch {
        /* location unavailable — ignore */
      }
      return; // no polling in dev
    }

    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const check = async () => {
      if (cancelled || document.hidden) return;
      const latest = await fetchLatestVersion();
      if (!cancelled && latest && latest !== CURRENT) setUpdateReady(true);
    };

    // Settle after load, then poll on an interval + whenever the tab is
    // brought back to the foreground (the most common "I left it open" case).
    const initial = window.setTimeout(check, 4000);
    const interval = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    // Nudge the SW to re-check (harmless if none), then hard-reload so the
    // browser pulls the fresh index.html and its new hashed bundles.
    try {
      void navigator.serviceWorker
        ?.getRegistration()
        .then((reg) => reg?.update().catch(() => {}))
        .catch(() => {});
    } catch {
      /* serviceWorker unavailable — ignore */
    }
    window.location.reload();
  }, []);

  const dismiss = useCallback(() => setUpdateReady(false), []);

  return { updateReady, applyUpdate, dismiss };
}
