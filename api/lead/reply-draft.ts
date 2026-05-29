/**
 * POST /api/lead/reply-draft
 *
 * Trainer is looking at a lead's AI call summary and wants to send a
 * personalised first WhatsApp without writing one from scratch. We feed the
 * call context (parent name, child name + age + position, intent label,
 * AI summary, next-steps bullets) to OpenAI and return a polished Romanian
 * WhatsApp opener the trainer can edit before sending.
 *
 * Auth: bearer JWT. Caller must be the lead's assigned trainer or in
 * cc_trainer_ids, or owner/super_admin.
 *
 * Body: { leadId: uuid }
 *
 * Returns 503 cleanly when OpenAI isn't configured so the inbox can fall
 * back to the existing hardcoded WhatsApp opener without surprising the user.
 */
import { z } from "zod";
import { serviceClient } from "../_lib/supabase.js";
import {
  generateText,
  isConfigured as openAIConfigured,
  OpenAINotConfiguredError,
} from "../_lib/openai.js";

const Body = z.object({
  leadId: z.string().uuid(),
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

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function readBody(req: Req): Record<string, unknown> {
  if (typeof req.body === "object" && req.body)
    return req.body as Record<string, unknown>;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

const SYSTEM_PROMPT = `You write the first WhatsApp message a Romanian football academy trainer sends to a parent who just spoke with the AI intake agent. Write ONLY in Romanian.

Voice and constraints:
- Warm, professional, conversational. Like a real coach texting a parent, not a marketing message.
- 50–90 words total. NEVER exceed 90 words.
- Open with "Bună, [parent first name]" — no "Dragă" or "Stimată".
- Reference the child by first name and age in the second line.
- Acknowledge what the parent asked about during the AI call (intent + summary).
- Propose ONE concrete next step (a trial training, a callback at a specific time, an in-person visit) — pick the one that fits the intent.
- Sign off with first name only (use the trainer's full name from context to derive it).
- DO NOT include hashtags, links, prices, emojis (one or two are okay if natural — never more), or "Salutări" formal closes.
- Keep all Romanian diacritics (ș, ț, ă, î, â).
- Plain text only — no markdown, no formatting characters. The trainer pastes this straight into WhatsApp.`;

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!openAIConfigured()) {
    return res.status(503).json({
      error: "ai_not_configured",
      message: "OpenAI key missing on this deployment.",
    });
  }

  const auth = readHeader(req, "authorization") ?? "";
  if (!/^bearer\s+/i.test(auth)) {
    return res.status(401).json({ error: "missing_bearer" });
  }
  const jwt = auth.replace(/^bearer\s+/i, "").trim();

  const parsed = Body.safeParse(readBody(req));
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_body", issues: parsed.error.issues });
  }
  const { leadId } = parsed.data;

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "invalid_jwt" });
  }
  const userId = userData.user.id;

  // Caller profile + trainer row to derive their slug for authorization
  const [{ data: prof }, { data: trainerRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("trainers")
      .select("id, age_min, age_max")
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);
  if (!prof) return res.status(401).json({ error: "no_profile" });

  let trainerSlug: string | null = null;
  if (trainerRow) {
    const mid = (trainerRow.age_min + trainerRow.age_max) / 2;
    trainerSlug = mid <= 9 ? "t-sopi" : mid <= 13 ? "t-kelemen" : "t-dan";
  }
  if (prof.role === "owner" || prof.role === "super_admin")
    trainerSlug = "t-dan";

  // Lead + latest completed call
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select(
      "id, parent_name, child_name, child_age, child_position, assigned_trainer_id, cc_trainer_ids, lead_calls (status, summary, intent, next_steps, created_at)"
    )
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return res.status(404).json({ error: "lead_not_found" });
  }

  const isAdmin = prof.role === "owner" || prof.role === "super_admin";
  const isAssigned =
    trainerSlug != null &&
    (lead.assigned_trainer_id === trainerSlug ||
      ((lead.cc_trainer_ids as string[]) ?? []).includes(trainerSlug));
  if (!isAdmin && !isAssigned) {
    return res.status(403).json({ error: "forbidden" });
  }

  type Call = {
    status?: string;
    summary?: string | null;
    intent?: string | null;
    next_steps?: string[] | null;
    created_at?: string;
  };
  const calls = (lead.lead_calls as Call[] | null) ?? [];
  const latest = calls
    .filter(c => c.status === "completed")
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];

  const intentLabel: Record<string, string> = {
    register: "Înscriere",
    visit: "Programare vizită",
    info: "Informații generale",
    price: "Preț / cost",
    schedule: "Program antrenamente",
    other: "Altele",
  };

  // Build the user prompt — the model only sees what we explicitly include.
  const trainerFirstName =
    (prof.full_name as string | null)?.split(" ")[0] ?? "antrenor";
  const userPrompt = `Date despre apel:
- Părinte: ${lead.parent_name}
- Copil: ${lead.child_name}, ${lead.child_age} ani${lead.child_position ? `, poziție ${lead.child_position}` : ""}
- Intenție: ${latest?.intent ? (intentLabel[latest.intent] ?? latest.intent) : "necunoscută"}
- Rezumatul apelului AI: ${latest?.summary ?? "fără rezumat"}
- Pașii următori sugerați de AI:
${
  latest?.next_steps && latest.next_steps.length
    ? latest.next_steps.map(s => `  · ${s}`).join("\n")
    : "  · (niciunul)"
}

Antrenorul care trimite mesajul: ${prof.full_name ?? "antrenor"} (semnează cu "${trainerFirstName}").

Scrie acum prima propunere de mesaj WhatsApp pentru părinte (50–90 cuvinte, română cu diacritice, plain text).`;

  let reply: string;
  try {
    reply = await generateText({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 300,
      temperature: 0.7,
    });
  } catch (err) {
    if (err instanceof OpenAINotConfiguredError) {
      return res.status(503).json({ error: "ai_not_configured" });
    }
    return res
      .status(502)
      .json({ error: "ai_generation_failed", detail: (err as Error).message });
  }

  return res.status(200).json({ ok: true, reply });
}
