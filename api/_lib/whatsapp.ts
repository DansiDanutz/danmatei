/**
 * Tiny client for the Meta WhatsApp Business Cloud API.
 * Sends a single text message to an E.164 number using a phone-number id
 * + a permanent access token. Both are configured via environment.
 *
 * If the required env vars aren't set, send() resolves with `{sent:false}`
 * instead of throwing — this lets local dev and preview deploys run end-to-end
 * without WhatsApp credentials. The signup flow falls through to "we'll
 * notify you when WhatsApp is wired up" copy in that case.
 *
 * Required env (production):
 *   - WHATSAPP_PHONE_ID            (numeric Meta phone-number id)
 *   - WHATSAPP_ACCESS_TOKEN        (permanent system-user token)
 *   - WHATSAPP_API_VERSION         (e.g. "v21.0", optional, defaults to v21.0)
 */
const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export interface SendTextResult {
  sent: boolean;
  reason?: string;
  messageId?: string;
}

interface MetaResponse {
  messages?: { id: string }[];
  error?: { message?: string; code?: number };
}

function normalizePhone(input: string): string {
  // Meta wants E.164 without the leading +.
  const trimmed = input.trim().replace(/[\s()-]/g, "");
  return trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
}

export async function sendWhatsappText(
  to: string,
  body: string,
): Promise<SendTextResult> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    return { sent: false, reason: "whatsapp_not_configured" };
  }
  if (!to || !body) {
    return { sent: false, reason: "missing_to_or_body" };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(to),
    type: "text",
    text: { preview_url: true, body },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as MetaResponse;
    if (!res.ok) {
      return {
        sent: false,
        reason: json.error?.message ?? `http_${res.status}`,
      };
    }
    return { sent: true, messageId: json.messages?.[0]?.id };
  } catch (e: unknown) {
    return {
      sent: false,
      reason: e instanceof Error ? e.message : "network_error",
    };
  }
}
