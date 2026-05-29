/**
 * useBrowserNotification — fires a native `Notification` when a new
 * inbox event arrives AND the tab is in the background (blurred).
 *
 * No service worker, no VAPID, no infra. Just the Notification API.
 * Works on every modern desktop browser; on iOS Safari it's a no-op
 * (we degrade gracefully to the sonner toast that's already in place).
 *
 *   const notify = useBrowserNotification();
 *   notify({ title: 'Lead nou', body: '...', tag: leadId });
 *
 * Permission states:
 *   "default"  → call `request()` from a user gesture (button click)
 *   "granted"  → notifications fire on hidden tab
 *   "denied"   → silently no-op (toast still fires)
 *
 * Notifications are auto-suppressed when the page is visible so users
 * don't get a double-ping (toast in-page + OS notification).
 */
import { useCallback, useEffect, useState } from "react";

export type Permission = "default" | "granted" | "denied" | "unsupported";

type NotifyOptions = {
  title: string;
  body?: string;
  tag?: string;
  /** When the user clicks the OS notification, focus the tab and call this. */
  onClick?: () => void;
};

function detectInitial(): Permission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as Permission;
}

export function useBrowserNotification(): {
  permission: Permission;
  request: () => Promise<Permission>;
  notify: (opts: NotifyOptions) => void;
  supported: boolean;
} {
  const [permission, setPermission] = useState<Permission>(() => detectInitial());

  // Keep state in sync if the user changes permission via the URL bar.
  useEffect(() => {
    if (permission === "unsupported") return;
    const onFocus = () => {
      const next = Notification.permission as Permission;
      setPermission((cur) => (cur === next ? cur : next));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [permission]);

  const request = useCallback(async (): Promise<Permission> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
      const result = await Notification.requestPermission();
      const mapped = result as Permission;
      setPermission(mapped);
      return mapped;
    } catch {
      return "denied";
    }
  }, []);

  const notify = useCallback(
    (opts: NotifyOptions) => {
      if (permission !== "granted") return;
      // Suppress when the tab is visible — the in-page toast handles it.
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        return;
      }
      try {
        const n = new Notification(opts.title, {
          body: opts.body,
          tag: opts.tag,
          icon: "/logo-official.jpg",
          badge: "/logo-official.jpg",
          silent: false,
        });
        if (opts.onClick) {
          n.onclick = (e) => {
            e.preventDefault();
            window.focus();
            opts.onClick?.();
            n.close();
          };
        }
      } catch {
        // Permission can be revoked between checks; ignore.
      }
    },
    [permission],
  );

  return {
    permission,
    request,
    notify,
    supported: permission !== "unsupported",
  };
}
