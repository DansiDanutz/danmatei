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
 * If the LLM provider is unavailable, we still return a conservative
 * deterministic draft from the same source data so the owner never clicks the
 * button and gets an empty form.
 */
import {
  serviceClient,
  getJwtFromHeader,
  getUserIdFromJwt,
} from "../_lib/supabase.js";
import {
  generateText,
  isConfigured as openAIConfigured,
  OpenAINotConfiguredError,
} from "../_lib/openai.js";
import { checkRateLimit } from "../_lib/ratelimit.js";

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
  setHeader?: (k: string, v: string) => void;
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

type TrainingRecapRow = {
  title?: string;
  starts_at?: string;
  recap_md?: string | null;
};

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

type NewKidRow = {
  full_name?: string;
  age_group_label?: string | null;
};

type DraftPayload = {
  title: string;
  body_md: string;
};

function roDate(value?: string): string {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.getTime())) return "recent";
  return date.toLocaleDateString("ro-RO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function compactText(value: string | null | undefined, max = 220): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

function firstName(value: string | null | undefined): string {
  return (value ?? "").trim().split(/\s+/)[0] || "un copil nou";
}

function normalizeMatchResult(match: MatchRow): MatchScore | null {
  return Array.isArray(match.match_results)
    ? (match.match_results[0] ?? null)
    : (match.match_results ?? null);
}

function fallbackDraft(
  recaps: TrainingRecapRow[],
  matches: MatchRow[],
  newKids: NewKidRow[],
): DraftPayload {
  const hasActivity = recaps.length > 0 || matches.length > 0 || newKids.length > 0;
  const title = hasActivity
    ? "Săptămână plină la Academia Dan Matei"
    : "Săptămâna copiilor la Academia Dan Matei";

  const parts: string[] = [
    "Săptămâna aceasta a adus un nou ritm bun pentru copiii Academiei Dan Matei, cu accent pe disciplină, bucuria jocului și pași mici făcuți constant pe teren.",
  ];

  if (recaps.length > 0) {
    const recapBullets = recaps.slice(0, 3).map(r => {
      const detail = compactText(r.recap_md, 180);
      return `- **${r.title ?? "Antrenament"}** (${roDate(r.starts_at)})${detail ? `: ${detail}` : ""}`;
    });
    parts.push(`## Antrenamente\n${recapBullets.join("\n")}`);
  }

  const matchesWithResults = matches
    .map(match => ({ match, result: normalizeMatchResult(match) }))
    .filter(item => item.result);
  if (matchesWithResults.length > 0) {
    const matchBullets = matchesWithResults.slice(0, 3).map(({ match, result }) => {
      const score = result
        ? `${result.our_score}-${result.opponent_score}`
        : "scor înregistrat";
      const recap = compactText(result?.recap_md, 140);
      return `- **${match.title ?? "Meci"}**${match.opponent ? ` vs ${match.opponent}` : ""} (${roDate(match.starts_at)}): ${score}${recap ? ` — ${recap}` : ""}`;
    });
    parts.push(`## Meciuri\n${matchBullets.join("\n")}`);
  }

  if (newKids.length > 0) {
    const names = newKids.slice(0, 6).map(k => firstName(k.full_name));
    parts.push(
      `## Familii noi\nLe spunem bun venit în academie lui ${names.join(", ")}. Ne bucurăm să vedem copii noi intrând în grupă și descoperind fotbalul într-un mediu organizat, prietenos și atent la ritmul fiecăruia.`
    );
  }

  if (!hasActivity) {
    parts.push(
      "Nu există încă recap-uri, meciuri sau copii noi salvați pentru ultimele 7 zile. Folosește acest draft ca punct de pornire și adaugă manual momentele importante înainte de publicare."
    );
  }

  parts.push(
    "Felicitări copiilor, antrenorilor și părinților pentru energia pusă în fiecare sesiune. Continuăm cu aceeași seriozitate și cu poftă de fotbal."
  );

  return { title, body_md: parts.join("\n\n") };
}

function parseDraftJson(raw: string): DraftPayload | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const candidates = [cleaned];
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as DraftPayload;
      if (typeof parsed.title === "string" && typeof parsed.body_md === "string") {
        return {
          title: parsed.title.trim(),
          body_md: parsed.body_md.trim(),
        };
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
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

  let userId: string;
  try {
    userId = await getUserIdFromJwt(jwt);
  } catch {
    return res.status(401).json({ error: "invalid_jwt" });
  }

  // Per-user/hour LLM rate limit (first-line defense — see api/_lib/ratelimit.ts)
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
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
  const recapRows = ((recaps as TrainingRecapRow[] | null) ?? []);
  const matchRows = ((matches as MatchRow[] | null) ?? []);
  const newKidRows = ((newKids as NewKidRow[] | null) ?? []);
  const fallback = fallbackDraft(recapRows, matchRows, newKidRows);

  const recapLines = recapRows
    .map(r => {
      const date = roDate(r.starts_at);
      const body = (r.recap_md ?? "").slice(0, 600).replace(/\s+/g, " ").trim();
      return `- ${date} · ${r.title}\n  ${body}`;
    })
    .join("\n");

  const matchLines = matchRows
    .map(m => {
      const date = roDate(m.starts_at);
      const result = normalizeMatchResult(m);
      const score = result
        ? `${result.our_score}-${result.opponent_score}`
        : "—";
      const recap = result?.recap_md
        ? (result.recap_md as string).slice(0, 400).replace(/\s+/g, " ").trim()
        : "";
      return `- ${date} · ${m.title}${m.opponent ? ` vs ${m.opponent}` : ""} · ${score}${recap ? `\n  ${recap}` : ""}`;
    })
    .join("\n");

  const newKidLines = newKidRows
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
    if (!openAIConfigured()) {
      return res.status(200).json({
        ok: true,
        ...fallback,
        fallback: true,
        warning: "ai_not_configured",
        sources: {
          recaps: recapRows.length,
          matches: matchRows.length,
          newFamilies: newKidRows.length,
        },
      });
    }

    const rl = checkRateLimit(
      `draft-weekly:${userId}`,
      20,
      60 * 60 * 1000,
    );
    if (!rl.ok) {
      res.setHeader?.("Retry-After", Math.ceil(rl.resetIn / 1000).toString());
      return res
        .status(429)
        .json({ error: "rate_limited", detail: "too many LLM requests" });
    }

    raw = await generateText({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 900,
      temperature: 0.5,
    });
  } catch (err) {
    if (err instanceof OpenAINotConfiguredError) {
      return res.status(200).json({
        ok: true,
        ...fallback,
        fallback: true,
        warning: "ai_not_configured",
        sources: {
          recaps: recapRows.length,
          matches: matchRows.length,
          newFamilies: newKidRows.length,
        },
      });
    }
    return res.status(200).json({
      ok: true,
      ...fallback,
      fallback: true,
      warning: "ai_generation_failed",
      detail: err instanceof Error ? err.message : "generation failed",
      sources: {
        recaps: recapRows.length,
        matches: matchRows.length,
        newFamilies: newKidRows.length,
      },
    });
  }

  const parsed = parseDraftJson(raw);
  if (!parsed) {
    return res.status(200).json({
      ok: true,
      ...fallback,
      fallback: true,
      warning: "ai_parse_failed",
      sources: {
        recaps: recapRows.length,
        matches: matchRows.length,
        newFamilies: newKidRows.length,
      },
    });
  }

  return res.status(200).json({
    ok: true,
    title: parsed.title,
    body_md: parsed.body_md,
    fallback: false,
    sources: {
      recaps: recapRows.length,
      matches: matchRows.length,
      newFamilies: newKidRows.length,
    },
  });
}
