/**
 * POST /api/news/draft-weekly
 *
 * Owner taps "Draft săptămânal cu AI" in /admin → Știri. We snapshot the
 * last 7 days from three sources:
 *   - schedule_events.recap_md (training recaps shipped in #57)
 *   - match_results joined with their schedule_event (scores, opponent)
 *   - children created_at within the window (new families)
 *
 * Feed the snapshot to OpenAI and return a polished Romanian news article
 * with a separate title and Markdown body. Nothing is persisted — owner
 * reviews/edits and publishes through the existing news form.
 *
 * Auth: owner or super_admin only.
 *
 * 503 when OpenAI isn't configured. The button hides itself after the first
 * 503 response so owners don't keep clicking.
 */
import { serviceClient, getJwtFromHeader } from "../_lib/supabase.js";
import {
  generateText,
  isConfigured as openAIConfigured,
  OpenAINotConfiguredError,
} from "../_lib/openai.js";

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

const SYSTEM_PROMPT = `You write the weekly news article for a Romanian youth football academy's public website. Write ONLY in Romanian, with diacritics (ș, ț, ă, î, â). The voice is warm, proud of the kids, accessible to parents and prospective families.

Return STRICT JSON with this exact shape:
{ "title": "...", "body_md": "..." }

Constraints:
- title: 4–10 words, energetic but not clickbait. NEVER use emojis. Capitalize naturally (not all-caps).
- body_md: 180–280 words, Markdown allowed (## subheads, **bold**, simple lists).
- Structure: a 1-sentence hook, then 2–3 short paragraphs grouped by topic (training highlights, match results, new families if applicable), then a short closing line.
- Refer to children by first name only when the source data mentions them. NEVER invent names, scores, or events the data does not contain.
- DO NOT include the date in the body — the site shows that separately.
- DO NOT include external links, hashtags, or emojis (zero — not even one).
- Plain content only, no front-matter, no code blocks. Just clean Markdown inside body_md.
- Output ONLY the JSON object, no surrounding prose, no markdown code fence.`;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

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

  const auth =
    (typeof req.headers?.authorization === "string"
      ? req.headers.authorization
      : Array.isArray(req.headers?.authorization)
        ? req.headers.authorization[0]
        : undefined) ?? "";
  const jwt = getJwtFromHeader(auth);
  if (!jwt) return res.status(401).json({ error: "missing_bearer" });

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
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!prof) return res.status(401).json({ error: "no_profile" });
  if (prof.role !== "owner" && prof.role !== "super_admin") {
    return res.status(403).json({ error: "owner_role_required" });
  }

  const since = isoDaysAgo(7);

  // 1) Training recaps from the last week
  const { data: recaps } = await supabase
    .from("schedule_events")
    .select("title, starts_at, recap_md")
    .eq("kind", "training")
    .gte("starts_at", since)
    .not("recap_md", "is", null)
    .order("starts_at", { ascending: false })
    .limit(15);

  // 2) Match results from the last week
  const { data: matches } = await supabase
    .from("schedule_events")
    .select(
      "title, starts_at, opponent, location, match_results (our_score, opponent_score, scorers, recap_md)"
    )
    .eq("kind", "match")
    .gte("starts_at", since)
    .order("starts_at", { ascending: false })
    .limit(10);

  // 3) New families in the last week
  const { data: newKids } = await supabase
    .from("children")
    .select("full_name, age_group_label, created_at")
    .gte("created_at", since)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  // Build a compact context. Limit each recap so we don't blow up tokens.
  const recapLines = (
    (recaps as {
      title?: string;
      starts_at?: string;
      recap_md?: string | null;
    }[]) ?? []
  )
    .map(r => {
      const date = new Date(r.starts_at ?? "").toLocaleDateString("ro-RO", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
      const body = (r.recap_md ?? "").slice(0, 600).replace(/\s+/g, " ").trim();
      return `- ${date} · ${r.title}\n  ${body}`;
    })
    .join("\n");

  type MatchScore = {
    our_score: number;
    opponent_score: number;
    scorers?: unknown;
    recap_md?: string | null;
  };
  type MatchRow = {
    title?: string;
    starts_at?: string;
    opponent?: string | null;
    location?: string | null;
    match_results?: MatchScore[] | MatchScore | null;
  };
  const matchLines = ((matches as MatchRow[]) ?? [])
    .map(m => {
      const date = new Date(m.starts_at ?? "").toLocaleDateString("ro-RO", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
      const result = Array.isArray(m.match_results)
        ? m.match_results[0]
        : (m.match_results as MatchScore | null);
      const score = result
        ? `${result.our_score}-${result.opponent_score}`
        : "—";
      const recap = result?.recap_md
        ? (result.recap_md as string).slice(0, 400).replace(/\s+/g, " ").trim()
        : "";
      return `- ${date} · ${m.title}${m.opponent ? ` vs ${m.opponent}` : ""} · ${score}${recap ? `\n  ${recap}` : ""}`;
    })
    .join("\n");

  const newKidLines = (
    (newKids as { full_name?: string; age_group_label?: string | null }[]) ?? []
  )
    .map(
      k =>
        `- ${(k.full_name ?? "").split(/\s+/)[0]} (${k.age_group_label ?? "fără grupă"})`
    )
    .join("\n");

  const userPrompt = `Sursele săptămânii (${new Date(since).toLocaleDateString("ro-RO")} → astăzi):

ANTRENAMENTE (cu recap-uri publicate):
${recapLines || "(niciun recap publicat săptămâna asta)"}

MECIURI:
${matchLines || "(niciun meci înregistrat săptămâna asta)"}

FAMILII NOI:
${newKidLines || "(nu s-au înregistrat copii noi)"}

Scrie acum articolul săptămânii (JSON strict { title, body_md }, 180–280 cuvinte body).`;

  let raw: string;
  try {
    raw = await generateText({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 900,
      temperature: 0.5,
    });
  } catch (err) {
    if (err instanceof OpenAINotConfiguredError) {
      return res.status(503).json({ error: "ai_not_configured" });
    }
    return res
      .status(502)
      .json({ error: "ai_generation_failed", detail: (err as Error).message });
  }

  // Strip accidental code fences if the model adds them despite the system
  // prompt asking otherwise.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: { title?: string; body_md?: string };
  try {
    parsed = JSON.parse(cleaned) as { title?: string; body_md?: string };
  } catch {
    return res.status(502).json({
      error: "ai_parse_failed",
      detail: "Model did not return valid JSON.",
      raw: cleaned.slice(0, 300),
    });
  }

  if (!parsed.title || !parsed.body_md) {
    return res.status(502).json({
      error: "ai_parse_failed",
      detail: "Missing title or body_md in response.",
    });
  }

  return res.status(200).json({
    ok: true,
    title: parsed.title,
    body_md: parsed.body_md,
    sources: {
      recaps: recapLines ? (recaps?.length ?? 0) : 0,
      matches: matchLines ? (matches?.length ?? 0) : 0,
      newFamilies: newKids?.length ?? 0,
    },
  });
}
