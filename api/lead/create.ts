/**
 * POST /api/lead/create
 *
 * Public endpoint — captures a parent lead, routes by child age, sends a
 * one-tap WhatsApp link that opens the AI voice agent in the browser.
 *
 * The WhatsApp send goes through the existing Meta Cloud API helper for
 * production. If the Evolution-API self-hosted gateway is configured
 * (EVOLUTION_API_URL + EVOLUTION_API_KEY), we prefer that. If neither is
 * wired up, we still persist the lead and return success — the call link
 * is included in the response so the form can surface a fallback CTA.
 *
 * See docs/AI_CALL_FLOW.md for the full design.
 */
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { serviceClient } from "../_lib/supabase.js";
import { sendWhatsappText } from "../_lib/whatsapp.js";
import { isLeadLinkSigningConfigured, signToken } from "../_lib/sign-token.js";

const Body = z.object({
  parentName: z.string().trim().min(2).max(120),
  parentPhone: z.string().trim().min(7).max(32),
  childName: z.string().trim().min(2).max(120),
  childAge: z.coerce.number().int().min(4).max(18),
  childPosition: z.string().trim().max(60).optional().nullable(),
  source: z.enum(["web", "app"]).default("web"),
  consent: z.literal(true),
});

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

const DEFAULT_PUBLIC_BASE_URL = "https://danmatei.vercel.app";

function readHeader(req: Req, key: string): string | undefined {
  const value = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function publicBaseUrl(req: Req): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const rawHost =
    readHeader(req, "x-forwarded-host") ?? readHeader(req, "host");
  if (!rawHost) return DEFAULT_PUBLIC_BASE_URL;

  const host = rawHost.split(",")[0].trim();
  const rawProto = readHeader(req, "x-forwarded-proto");
  const proto =
    rawProto?.split(",")[0].trim() ||
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");

  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return DEFAULT_PUBLIC_BASE_URL;
  }
}

/** Hardcoded fallback used only when trainers.slug has not been populated. */
function trainerForAgeFallback(age: number): string {
  if (age >= 5 && age <= 9) return "t-sopi";
  if (age >= 10 && age <= 13) return "t-kelemen";
  return "t-dan";
}

/**
 * Return the slug of the active trainer whose age band covers childAge.
 * Calls trainer_slug_for_age() (from migration 0026) so routing follows the
 * real trainer table instead of hardcoded ranges.  Falls back to the legacy
 * heuristic when no trainer has a slug set yet (initial deploy, new academy).
 */
async function trainerForAge(
  supabase: ReturnType<typeof serviceClient>,
  childAge: number,
): Promise<string> {
  try {
    const { data } = await supabase.rpc("trainer_slug_for_age", {
      p_age: childAge,
    });
    if (typeof data === "string" && data.length > 0) return data;
  } catch {
    // Fall through to heuristic on any error (e.g. migration not yet applied).
  }
  return trainerForAgeFallback(childAge);
}

function normalizePhone(input: string): string {
  const cleaned = input.trim();
  const parsed = parsePhoneNumberFromString(cleaned, "RO");
  if (parsed?.isValid()) return parsed.format("E.164");
  // Fallback to manual normalization for resilience.
  const stripped = cleaned.replace(/[\s()-]+/g, "");
  if (stripped.startsWith("+")) return stripped;
  if (/^0\d{9}$/.test(stripped)) return `+4${stripped}`;
  return `+${stripped.replace(/^0+/, "")}`;
}

function callLink(leadId: string, baseUrl: string): string {
  return `${baseUrl}/apel/${signToken(leadId)}`;
}

function whatsappCopy(parentName: string, childName: string, link: string) {
  return [
    `Salut, ${parentName}! 👋`,
    "",
    `Mulțumim că ești interesat(ă) de Academia de Fotbal Dan Matei pentru ${childName}.`,
    "",
    "Apasă linkul de mai jos pentru a vorbi imediat cu un consilier al academiei (apel audio direct în browser, fără descărcări):",
    "",
    link,
    "",
    "Conversația durează 3-5 minute. La final, antrenorul grupei tale primește rezumatul și te va contacta pentru programare.",
    "",
    "— Echipa Dan Matei · Cluj-Napoca",
  ].join("\n");
}

async function tryEvolution(
  to: string,
  body: string
): Promise<{ sent: boolean; messageId?: string; reason?: string }> {
  const base = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_API_INSTANCE;
  if (!base || !key || !instance)
    return { sent: false, reason: "evolution_not_configured" };

  try {
    const r = await fetch(
      `${base.replace(/\/$/, "")}/message/sendText/${instance}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", apikey: key },
        body: JSON.stringify({ number: to.replace(/^\+/, ""), text: body }),
      }
    );
    if (!r.ok) return { sent: false, reason: `evolution_${r.status}` };
    const json = (await r.json()) as { key?: { id?: string } };
    return { sent: true, messageId: json.key?.id };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_body",
      issues: parsed.error.issues.map(i => ({
        path: i.path,
        message: i.message,
      })),
    });
  }
  const input = parsed.data;

  if (!isLeadLinkSigningConfigured()) {
    return res.status(503).json({
      error: "lead_link_signing_unavailable",
      message: "LEAD_LINK_SIGNING_SECRET is required in production.",
    });
  }

  const phoneE164 = normalizePhone(input.parentPhone);

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    // Local/dev deploy without service role — gracefully no-op
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Route to the trainer whose DB age band covers this child. Falls back to
  // the hardcoded heuristic until trainer slugs are seeded (migration 0026).
  const trainerId = await trainerForAge(supabase, input.childAge);

  // Per-phone rate limit: reject if the same phone has already created 5+
  // leads in the last hour. Uses the existing leads table — no new schema.
  {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: rlErr } = await supabase
      .from("leads")
      .select("id", { head: true, count: "exact" })
      .eq("parent_phone_e164", phoneE164)
      .gte("created_at", since);
    if (!rlErr && (recentCount ?? 0) >= 5) {
      return res.status(429).json({
        error: "rate_limited",
        detail: "too many requests from this phone",
      });
    }
  }

  const { data: leadRow, error: insErr } = await supabase
    .from("leads")
    .insert({
      parent_name: input.parentName,
      parent_phone: input.parentPhone,
      parent_phone_e164: phoneE164,
      child_name: input.childName,
      child_age: input.childAge,
      child_position: input.childPosition ?? null,
      source: input.source,
      assigned_trainer_id: trainerId,
      // Dan is CC'd on every lead EXCEPT when he is already the primary
      // trainer (avoids duplicate notifications to himself).
      cc_trainer_ids: trainerId === "t-dan" ? [] : ["t-dan"],
      consent_at: new Date().toISOString(),
      status: "new",
    })
    .select("id")
    .single();

  if (insErr || !leadRow) {
    return res
      .status(500)
      .json({ error: "lead_insert_failed", detail: insErr?.message });
  }

  const leadId = leadRow.id as string;
  const link = callLink(leadId, publicBaseUrl(req));
  const message = whatsappCopy(input.parentName, input.childName, link);

  // Prefer Evolution API (open source); fall back to Meta Cloud API.
  let waResult = await tryEvolution(phoneE164, message);
  if (!waResult.sent) {
    const metaResult = await sendWhatsappText(phoneE164, message);
    waResult = {
      sent: metaResult.sent,
      messageId: metaResult.messageId,
      reason: metaResult.reason ?? waResult.reason,
    };
  }

  if (waResult.sent) {
    await supabase
      .from("leads")
      .update({ status: "wa_sent", updated_at: new Date().toISOString() })
      .eq("id", leadId);
  }

  return res.status(200).json({
    ok: true,
    // Mirrors `whatsapp.sent` so callers (LeadForm) can branch on a single
    // top-level flag and render a fallback CTA when delivery failed.
    success: waResult.sent,
    leadId,
    trainerId,
    callLink: link,
    whatsapp: {
      sent: waResult.sent,
      reason: waResult.reason ?? null,
      messageId: waResult.messageId ?? null,
    },
  });
}
