/**
 * Chat-completions helper — OpenAI-compatible, provider-agnostic.
 *
 * Direct fetch (no SDK) keeps the dependency surface tiny. Used by features
 * that want to generate short Romanian copy server-side: training recaps,
 * weekly digests, lead reply drafts.
 *
 * Configuration:
 *   OPENAI_API_KEY        — required (any provider's bearer token)
 *   OPENAI_BASE_URL       — default "https://api.openai.com/v1"
 *                           Override to point at any OpenAI-compat provider:
 *                             - Google Gemini:
 *                               https://generativelanguage.googleapis.com/v1beta/openai
 *                             - OpenRouter:
 *                               https://openrouter.ai/api/v1
 *                             - Z.ai (when topped up):
 *                               https://api.z.ai/api/paas/v4
 *                             - Cerebras:
 *                               https://api.cerebras.ai/v1
 *                             - Local Ollama via Tailscale:
 *                               http://100.79.10.102:11434/v1
 *   OPENAI_MODEL          — default "gpt-4o-mini"
 *                           Auto-corrected to "gemini-2.0-flash" when the
 *                           base URL is Gemini and the model still has the
 *                           gpt-* default — avoids 404s after a half-set env.
 *
 * Mirrors the same provider-agnostic pattern used in the voice agent
 * (services/voice-agent/agent.py) so both sides can be pointed at the
 * academy's free / flat-fee provider stack instead of pay-per-token OpenAI.
 *
 * Graceful degradation: if OPENAI_API_KEY is missing, `isConfigured()`
 * returns false and `generateText()` throws a typed error so callers can
 * return a clean 503 to the client.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const RAW_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
// Strip a trailing slash so `${BASE_URL}/chat/completions` always produces a
// clean URL regardless of how the env was set.
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");
const RAW_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
// If the operator pointed at Gemini's OpenAI-compat URL but kept the
// hardcoded gpt-* default model name, Gemini will 404. Nudge to a sensible
// Gemini model so a half-finished env switch still works.
const MODEL =
  BASE_URL.includes("generativelanguage.googleapis.com") &&
  RAW_MODEL.startsWith("gpt-")
    ? "gemini-2.0-flash"
    : RAW_MODEL;

export class OpenAINotConfiguredError extends Error {
  constructor() {
    super("OpenAI-compat API key not configured on this deployment.");
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

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
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
    throw new Error(
      `LLM HTTP ${response.status} from ${BASE_URL}: ${errBody.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("LLM returned empty content");
  }
  return text;
}
