/**
 * Web Push helper.
 *
 * Wraps the `web-push` library plus our `push_subscriptions` table so the rest
 * of the API can fan out background notifications without thinking about
 * VAPID, dead endpoints, or env-not-set cases.
 *
 * VAPID config comes from env (see README "Web Push setup"):
 *   VAPID_PUBLIC_KEY    — base64url public key (also exposed to the client)
 *   VAPID_PRIVATE_KEY   — base64url private key (server-only)
 *   VAPID_SUBJECT       — "mailto:contact@danmatei.ro" or similar
 *
 * If any of those are missing the helper degrades gracefully:
 *   - `isConfigured()` returns false
 *   - `sendPushToUsers()` resolves to { sent: 0, skipped: <n>, removed: 0 }
 *     and never throws.
 *
 * That lets the feature ship behind feature-flag-by-env: PR can deploy to
 * Vercel before VAPID keys are pasted, in-app notifications keep working,
 * and push lights up the moment the env vars are set.
 */
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { serviceClient } from "./supabase.js";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "";

let configured = false;
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE && VAPID_SUBJECT) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  }
} catch {
  // Bad keys — leave configured = false.
  configured = false;
}

export function isConfigured(): boolean {
  return configured;
}

export function getVapidPublicKey(): string | null {
  return configured ? VAPID_PUBLIC : null;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Tag — used to coalesce duplicate notifications on the OS surface. */
  tag?: string;
  /** URL to focus / open when the user clicks the notification. */
  url?: string;
};

/**
 * Send a push notification to every subscription belonging to the given users.
 * Best-effort: any per-subscription failure (timeout, rejected, dead endpoint)
 * is captured and dead endpoints are removed from the database.
 *
 * Returns a small summary the caller can log; never throws.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; skipped: number; removed: number }> {
  if (!configured || userIds.length === 0) {
    return { sent: 0, skipped: userIds.length, removed: 0 };
  }

  const svc = serviceClient();
  const { data: subs, error } = await svc
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error || !subs) {
    return { sent: 0, skipped: userIds.length, removed: 0 };
  }

  const body = JSON.stringify(payload);
  const deadIds: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async sub => {
      const subscription: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, body, { TTL: 60 * 60 * 24 });
        sent += 1;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 404 / 410 = subscription is dead, drop it.
        if (code === 404 || code === 410) {
          deadIds.push(sub.id);
        }
      }
    })
  );

  if (deadIds.length > 0) {
    await svc.from("push_subscriptions").delete().in("id", deadIds);
  }

  return { sent, skipped: 0, removed: deadIds.length };
}
