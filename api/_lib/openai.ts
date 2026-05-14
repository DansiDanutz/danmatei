/**
 * OpenAI helper — minimal Chat Completions wrapper.
 *
 * Direct fetch (no SDK) keeps the dependency surface tiny. Used by features
 * that want to generate short Romanian copy server-side: training recaps,
 * weekly digests, lead reply drafts.
 *
 * Configuration:
 *   OPENAI_API_KEY        — required
 *   OPENAI_MODEL          — default "gpt-4o-mini"
 *
 * Graceful degradation: if OPENAI_API_KEY is missing, `isConfigured()`
 * returns false and `generateText()` throws a typed error so callers can
 * return a clean 503 to the client. The feature can ship behind feature-
 * flag-by-env: PR deploys to Vercel before the key is pasted, and the
 * "Generează cu AI" button shows a friendly "AI not configured yet" state.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export class OpenAINotConfiguredError extends Error {
  constructor() {
    super("OpenAI API key not configured on this deployment.");
    this.name = "OpenAINotConfiguredError";
  }
}

export function isConfigured(): boolean {
  return OPENAI_API_KEY.length > 0;
}

type GenerateInput = {
  /** System prompt — sets role, tone, language. */
  system: string;
  /** User prompt — the actual content to react to. */
  user: string;
  /** Hard cap on output tokens. Defaults to 600 (~ 400 Romanian words). */
  maxTokens?: number;
  /** 0–2. Lower = more deterministic. Default 0.6 — natural but not wild. */
  temperature?: number;
};

/**
 * Returns the assistant's text reply. Throws OpenAINotConfiguredError when
 * the env key is missing, and a generic Error on API/network failure.
 */
export async function generateText(input: GenerateInput): Promise<string> {
  if (!isConfigured()) {
    throw new OpenAINotConfiguredError();
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      max_tokens: input.maxTokens ?? 600,
      temperature: input.temperature ?? 0.6,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${response.status}: ${errBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned empty content");
  }
  return text;
}
