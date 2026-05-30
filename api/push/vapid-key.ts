/**
 * GET /api/push/vapid-key — returns the VAPID public key the browser needs
 * to call PushManager.subscribe(). Public endpoint — the public key is, well,
 * public; the only thing it lets the browser do is target our push service.
 *
 * Returns `{ configured: false }` when push isn't configured yet so the client
 * can hide push controls without logging a noisy failed network request.
 */
import { getVapidPublicKey, isConfigured } from "../_lib/push.js";

type Req = { method?: string };
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

export default function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isConfigured()) {
    return res.status(200).json({ configured: false, publicKey: null });
  }
  return res
    .status(200)
    .json({ configured: true, publicKey: getVapidPublicKey() });
}
