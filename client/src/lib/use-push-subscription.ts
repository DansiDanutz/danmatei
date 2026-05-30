/**
 * usePushSubscription — Web Push for the current user.
 *
 * Once signed in, the device auto-restores push when the browser permission was
 * already granted unless the user previously turned it off (opt-out, persisted
 * in localStorage). If permission is still undecided, the bell's PushToggle asks
 * only after a user click; we do not fire the native browser prompt on page load.
 *
 * Lifecycle:
 *  1. On mount, checks browser support, current Notification permission, and
 *     whether a PushSubscription already exists in the registered SW.
 *  2. `subscribe()` requests permission (if needed), then asks the SW to
 *     create a PushSubscription with our VAPID public key (fetched from
 *     /api/push/vapid-key), then POSTs it to /api/push/subscribe.
 *  3. `unsubscribe()` calls .unsubscribe() on the browser side and DELETEs
 *     the row server-side via /api/push/unsubscribe.
 *
 * Server-side gracefully degrades when VAPID isn't configured (vapid-key
 * returns `{ configured: false }`). In that case `supported = false` so the UI
 * can show a clear "push not available" state instead of a confusing crash.
 *
 * Distinct from `use-browser-notification.ts`, which uses the in-page
 * Notification API only (visible only while a tab is open). This hook gives
 * us actual background delivery — phone screen off, browser closed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status =
  | "checking"
  | "unsupported"
  | "not-configured"
  | "denied"
  | "subscribed"
  | "unsubscribed";

type State = {
  status: Status;
  loading: boolean;
  error: string | null;
};

const VAPID_KEY_ENDPOINT = "/api/push/vapid-key";
const SUBSCRIBE_ENDPOINT = "/api/push/subscribe";
const UNSUBSCRIBE_ENDPOINT = "/api/push/unsubscribe";

// Per-device flags backing the "enabled by default" behaviour.
const OPT_OUT_KEY = "push-opt-out"; // set when the user turns push off

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — non-fatal */
  }
}
function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable — non-fatal */
  }
}
const isOptedOut = (): boolean => lsGet(OPT_OUT_KEY) === "1";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // The SW registration is owned by main.tsx — don't re-register here.
  // Wait for whichever one already exists.
  const reg = await navigator.serviceWorker.ready;
  return reg ?? null;
}

async function fetchVapidKey(): Promise<string | null> {
  try {
    const r = await fetch(VAPID_KEY_ENDPOINT);
    if (!r.ok) return null;
    const j = (await r.json().catch(() => null)) as {
      configured?: boolean;
      publicKey?: string;
    } | null;
    if (j?.configured === false) return null;
    return j?.publicKey ?? null;
  } catch {
    return null;
  }
}

export function usePushSubscription() {
  const [state, setState] = useState<State>({
    status: "checking",
    loading: false,
    error: null,
  });
  const autoTriedRef = useRef(false);

  // Initial check.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Browser feature support
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        typeof Notification === "undefined"
      ) {
        if (!cancelled)
          setState({ status: "unsupported", loading: false, error: null });
        return;
      }

      // Server config
      const key = await fetchVapidKey();
      if (cancelled) return;
      if (!key) {
        setState({ status: "not-configured", loading: false, error: null });
        return;
      }

      if (Notification.permission === "denied") {
        setState({ status: "denied", loading: false, error: null });
        return;
      }

      const reg = await getRegistration();
      if (cancelled) return;
      const existing = await reg?.pushManager.getSubscription();
      if (cancelled) return;
      setState({
        status: existing ? "subscribed" : "unsubscribed",
        loading: false,
        error: null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    // Enabling clears any prior opt-out so default-on keeps this device on.
    lsRemove(OPT_OUT_KEY);
    setState(s => ({ ...s, loading: true, error: null }));

    const key = await fetchVapidKey();
    if (!key) {
      setState({ status: "not-configured", loading: false, error: null });
      return;
    }

    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState({
          status: perm === "denied" ? "denied" : "unsubscribed",
          loading: false,
          error: null,
        });
        return;
      }
    }

    const reg = await getRegistration();
    if (!reg) {
      setState({
        status: "unsupported",
        loading: false,
        error: "Service worker not registered.",
      });
      return;
    }

    let pushSub: PushSubscription;
    try {
      pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    } catch (e) {
      setState({
        status: "unsubscribed",
        loading: false,
        error: (e as Error).message,
      });
      return;
    }

    const json = pushSub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      setState({
        status: "unsubscribed",
        loading: false,
        error: "Subscription missing required fields.",
      });
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setState({
        status: "unsubscribed",
        loading: false,
        error: "Not authenticated.",
      });
      return;
    }

    const r = await fetch(SUBSCRIBE_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent.slice(0, 500),
      }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      // Roll back the browser subscription so we stay in sync with the server.
      await pushSub.unsubscribe().catch(() => {});
      setState({
        status: "unsubscribed",
        loading: false,
        error: j?.error ?? `HTTP ${r.status}`,
      });
      return;
    }

    setState({ status: "subscribed", loading: false, error: null });
  }, []);

  // Default-on without surprising prompts: if the user already granted browser
  // permission, restore the subscription automatically. If permission is still
  // "default", wait for a click on the bell popover's PushToggle.
  useEffect(() => {
    if (autoTriedRef.current) return;
    if (state.status !== "unsubscribed") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "denied") return;
    if (isOptedOut()) return;
    if (Notification.permission !== "granted") return;
    autoTriedRef.current = true;
    void subscribe();
  }, [state.status, subscribe]);

  const unsubscribe = useCallback(async () => {
    // Remember the user turned push off so we don't auto-resubscribe them.
    lsSet(OPT_OUT_KEY, "1");
    setState(s => ({ ...s, loading: true, error: null }));

    const reg = await getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    const endpoint = sub?.endpoint;

    if (sub) {
      await sub.unsubscribe().catch(() => {});
    }

    if (endpoint) {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (token) {
        await fetch(UNSUBSCRIBE_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
    }

    setState({ status: "unsubscribed", loading: false, error: null });
  }, []);

  return {
    status: state.status,
    loading: state.loading,
    error: state.error,
    subscribe,
    unsubscribe,
  };
}
