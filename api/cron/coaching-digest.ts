/**
 * GET /api/cron/coaching-digest — once-daily coaching digest (Vercel Cron).
 *
 * For every active trainer (tailored to their group's age band) and the
 * owner(s), produces ONE short coaching item — a drill idea, skill tip or
 * mini-report grounded in how elite academies train — and delivers it via an
 * in-app notification + Web Push, plus a persistent row in fotbal.coaching_tips
 * (the "Sfaturi" feed).
 *
 * Content: a FREE OpenAI-compatible model (api/_lib/openai) writes a fresh,
 * age-tailored tip seeded by that day's library theme; if the model is not
 * configured or is slow/erroring, the curated library tip is used directly.
 * Either way the digest is never empty.
 *
 * Idempotent: one tip per recipient per day (unique recipient_id + tip_date).
 *
 * Auth: Vercel Cron sets Authorization: Bearer ${CRON_SECRET}.
 */
import { serviceClient } from "../_lib/supabase.js";
import { requireCron } from "../_lib/cron-auth.js";
import { sendPushToUsers } from "../_lib/push.js";
import { generateText, isConfigured } from "../_lib/openai.js";
import {
  bandForAge,
  bandLabel,
  pickTip,
  type AgeBand,
  type CoachingTip,
} from "../_lib/coaching-tips.js";

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};


type Recipient = { profileId: string; band: AgeBand };
type GeneratedTip = {
  recipientId: string;
  band: AgeBand;
  title: string;
  body: string;
  source: string;
  theme: string;
  fromAi: boolean;
};

const AI_TIMEOUT_MS = 6000;

/** Pull the first {...} JSON object out of an LLM reply (tolerates code fences). */
export function parseTip(text: string): { title: string; body: string; source: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    const body = typeof obj.body === "string" ? obj.body.trim() : "";
    const source = typeof obj.source === "string" ? obj.source.trim() : "";
    if (!title || !body) return null;
    return { title, body, source };
  } catch {
    return null;
  }
}

async function aiTip(
  band: AgeBand,
  seed: CoachingTip
): Promise<{ title: string; body: string; source: string } | null> {
  const system =
    "Ești instructor principal la o academie de fotbal de top din lume. " +
    "Scrii un singur sfat zilnic, scurt și aplicabil, pentru un antrenor de juniori, în limba română. " +
    "Fundamentează-l pe metodologii reale (La Masia, Ajax, Coerver, Horst Wein, DFB, LTAD, periodizare tactică). " +
    'Răspunde DOAR cu JSON valid, fără alt text: {"title": string (max 8 cuvinte), ' +
    '"body": string (2-4 propoziții, ton cald și concret, fără clișee), ' +
    '"source": string (metodologia sau academia care inspiră sfatul)}.';
  const user =
    `Grupa de vârstă: ${bandLabel(band)}. ` +
    `Tema de azi: ${seed.theme}. Inspirație: ${seed.source}. ` +
    `Scrie un sfat NOU, diferit de exemplele cunoscute, potrivit acestei vârste.`;

  try {
    const text = await Promise.race([
      generateText({ system, user, maxTokens: 600, temperature: 0.75 }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("ai_timeout")), AI_TIMEOUT_MS)
      ),
    ]);
    return parseTip(text);
  } catch {
    return null;
  }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!requireCron(req, res, "cron/coaching-digest")) return;

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Today's date in the academy's timezone + a day index for tip rotation.
  const todayStr = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Bucharest",
  }); // YYYY-MM-DD
  const year = Number(todayStr.slice(0, 4));
  const dayIndex = Math.round(
    (Date.parse(`${todayStr}T00:00:00Z`) - Date.parse(`${year}-01-01T00:00:00Z`)) /
      86_400_000
  );

  const [{ data: trainers }, { data: owners }] = await Promise.all([
    supabase
      .from("trainers")
      .select("profile_id, age_min, age_max")
      .eq("active", true),
    supabase.from("profiles").select("id").in("role", ["owner", "super_admin"]),
  ]);

  // One entry per profile (trainers first, then owners; no double-tips).
  const byProfile = new Map<string, Recipient>();
  for (const t of (trainers ?? []) as Array<{
    profile_id: string | null;
    age_min: number | null;
    age_max: number | null;
  }>) {
    if (t.profile_id && !byProfile.has(t.profile_id)) {
      byProfile.set(t.profile_id, {
        profileId: t.profile_id,
        band: bandForAge(t.age_min, t.age_max),
      });
    }
  }
  for (const o of (owners ?? []) as Array<{ id: string }>) {
    if (!byProfile.has(o.id)) {
      byProfile.set(o.id, { profileId: o.id, band: "owner" });
    }
  }
  const recipients = Array.from(byProfile.values());

  // Idempotency: skip anyone who already has today's tip.
  const ids = recipients.map((r) => r.profileId);
  const { data: existing } = ids.length
    ? await supabase
        .from("coaching_tips")
        .select("recipient_id")
        .eq("tip_date", todayStr)
        .in("recipient_id", ids)
    : { data: [] as { recipient_id: string }[] };
  const already = new Set(
    ((existing ?? []) as { recipient_id: string }[]).map((r) => r.recipient_id)
  );
  const todo = recipients.filter((r) => !already.has(r.profileId));

  const aiOn = isConfigured();

  // Build each recipient's tip (AI when available, library otherwise) in parallel.
  const tips: GeneratedTip[] = await Promise.all(
    todo.map(async (r): Promise<GeneratedTip> => {
      const seed = pickTip(r.band, dayIndex);
      const ai = aiOn ? await aiTip(r.band, seed) : null;
      return {
        recipientId: r.profileId,
        band: r.band,
        theme: seed.theme,
        title: ai?.title || seed.title,
        body: ai?.body || seed.body,
        source: ai?.source || seed.source,
        fromAi: !!ai,
      };
    })
  );

  if (tips.length > 0) {
    await supabase.from("coaching_tips").insert(
      tips.map((t) => ({
        recipient_id: t.recipientId,
        age_band: bandLabel(t.band),
        theme: t.theme,
        title: t.title,
        body_md: t.body,
        source: t.source,
        tip_date: todayStr,
      }))
    );

    await supabase.from("notifications").insert(
      tips.map((t) => ({
        recipient_id: t.recipientId,
        kind: "coaching_tip",
        title: `💡 Sfatul zilei: ${t.title}`,
        body: t.body.length > 160 ? `${t.body.slice(0, 157)}…` : t.body,
        link: t.band === "owner" ? "/admin" : "/antrenor",
      }))
    );

    await Promise.all(
      tips.map((t) =>
        sendPushToUsers([t.recipientId], {
          title: `💡 ${t.title}`,
          body: t.body.length > 160 ? `${t.body.slice(0, 157)}…` : t.body,
          tag: `coaching-${todayStr}`,
          url: t.band === "owner" ? "/admin" : "/antrenor",
        })
      )
    );
  }

  // Honest reporting: aiGenerated = tips the LLM actually produced;
  // fromLibrary = curated fallbacks (LLM off, timed out, errored, or unparseable).
  const aiGenerated = tips.filter((t) => t.fromAi).length;
  return res.status(200).json({
    ok: true,
    date: todayStr,
    recipients: recipients.length,
    delivered: tips.length,
    skipped: recipients.length - tips.length,
    aiConfigured: aiOn,
    aiGenerated,
    fromLibrary: tips.length - aiGenerated,
  });
}
