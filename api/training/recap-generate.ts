/**
 * POST /api/training/recap-generate
 *
 * Trainer feeds 2-5 short bullet notes from a training session; we ask the
 * AI to turn them into a polished, parent-facing Romanian recap. Nothing is
 * persisted at this stage — the trainer reviews the draft, edits if they
 * want, and then calls /api/training/recap-publish to send it out.
 *
 * Auth: bearer JWT. Caller must be the event's trainer or owner/super_admin.
 *
 * Body: { eventId: uuid, notes: string }
 *   - notes: free-form trainer text. We trim and pass through verbatim;
 *     the system prompt handles tone, length, structure.
 *
 * Returns 503 when OpenAI isn't configured so the UI can show a clear
 * "AI not available — write the recap yourself" state.
 */
import { z } from "zod";
import { serviceClient, getJwtFromHeader } from "../_lib/supabase.js";
import {
  generateText,
  isConfigured as openAIConfigured,
  OpenAINotConfiguredError,
} from "../_lib/openai.js";

const Body = z.object({
  eventId: z.string().uuid(),
  notes: z.string().trim().min(5).max(2000),
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

const SYSTEM_PROMPT = `You are writing a short post-training recap for parents of a Romanian youth football academy. Write ONLY in Romanian, in a warm but professional tone. The audience is busy parents who want to know what their child worked on today.

Constraints:
- 60–110 words total. NEVER exceed 110 words.
- 2–4 short paragraphs OR a single tight paragraph if that reads more natural.
- Reference specific kids by first name when the trainer's notes mention them.
- Mention what was worked on, then what stood out (effort, progress, a specific moment), then a brief encouraging close.
- DO NOT use emojis.
- DO NOT invent facts the trainer didn't provide.
- DO NOT include greetings ("Bună ziua") or sign-offs ("Salutări"); the messaging surface adds those itself.
- Keep diacritics (ș, ț, ă, î, â).`;

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
  const jwt = getJwtFromHeader(auth);
  if (!jwt) return res.status(401).json({ error: "missing_bearer" });

  const parsed = Body.safeParse(readBody(req));
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_body",
      issues: parsed.error.issues,
    });
  }
  const { eventId, notes } = parsed.data;

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Authenticate caller and load their profile
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "invalid_jwt" });
  }
  const userId = userData.user.id;

  const { data: prof } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) return res.status(401).json({ error: "no_profile" });
  const isAdmin = prof.role === "owner" || prof.role === "super_admin";

  // Load the event + its trainer to authorize
  const { data: event, error: evErr } = await supabase
    .from("schedule_events")
    .select(
      "id, kind, title, starts_at, location, trainer_id, trainers:trainer_id (profile_id, profile:profile_id (full_name))"
    )
    .eq("id", eventId)
    .maybeSingle();
  if (evErr || !event) {
    return res.status(404).json({ error: "event_not_found" });
  }

  const eventTrainer = event.trainers as {
    profile_id?: string;
    profile?: { full_name?: string } | null;
  } | null;
  const isOwner = isAdmin;
  const isAssigned =
    !!eventTrainer?.profile_id && eventTrainer.profile_id === userId;
  if (!isOwner && !isAssigned) {
    return res.status(403).json({ error: "forbidden" });
  }

  // Build a tight context string for the model. The model never sees PII
  // beyond what the trainer typed; we include only metadata.
  const dateRO = new Date(event.starts_at as string).toLocaleString("ro-RO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const trainerName = eventTrainer?.profile?.full_name ?? "antrenorul";
  const eventKind =
    event.kind === "training"
      ? "Antrenament"
      : event.kind === "tournament"
        ? "Turneu"
        : event.kind === "match"
          ? "Meci"
          : "Sesiune";
  const userPrompt = `${eventKind}: ${event.title}
Data: ${dateRO}${event.location ? ` · ${event.location}` : ""}
Antrenor: ${trainerName}

Notițele antrenorului (în ordinea pe care a scris-o):
${notes}

Scrie acum recap-ul pentru părinți (60–110 cuvinte, română cu diacritice).`;

  let recap: string;
  try {
    recap = await generateText({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 350,
      temperature: 0.6,
    });
  } catch (err) {
    if (err instanceof OpenAINotConfiguredError) {
      return res.status(503).json({ error: "ai_not_configured" });
    }
    return res
      .status(502)
      .json({ error: "ai_generation_failed", detail: (err as Error).message });
  }

  return res.status(200).json({ ok: true, recap });
}
