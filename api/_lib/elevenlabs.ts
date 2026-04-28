/**
 * Helper for the ElevenLabs Conversational AI ("agents") API.
 *
 * The flow:
 *   1. The owner provisions one or more ConvAI agents in the ElevenLabs
 *      dashboard (https://elevenlabs.io/app/conversational-ai). Each
 *      trainer can be linked to an agent via `trainers.elevenlabs_agent_id`,
 *      with a fallback to the academy-wide DEFAULT agent.
 *   2. When a parent signs up, /api/ai/start-conversation creates a new
 *      shareable session URL for the assigned trainer's agent and stores
 *      it on `ai_conversations`. We use ElevenLabs' "shareable links" so
 *      the parent doesn't need an ElevenLabs account.
 *   3. ElevenLabs delivers a webhook on conversation_end. /api/ai/webhook
 *      receives it, fetches the transcript, and updates the row.
 *
 * If env keys aren't set, this module returns a stub link pointing back at
 * /assistant/<token> so the rest of the flow still works in dev.
 *
 * Required env (production):
 *   - ELEVENLABS_API_KEY
 *   - ELEVENLABS_DEFAULT_AGENT_ID
 *   - ELEVENLABS_WEBHOOK_SECRET   (optional but recommended)
 */
const API_BASE = "https://api.elevenlabs.io/v1";

export interface AgentLinkResult {
  link: string;
  agentId: string;
  conversationId?: string;
  source: "elevenlabs" | "stub";
}

interface SignedUrlResponse {
  signed_url?: string;
  conversation_id?: string;
}

export interface TranscriptTurn {
  role: "user" | "agent";
  text: string;
  time?: number;
}

export interface TranscriptResult {
  conversationId: string;
  status: string;
  durationSeconds?: number;
  turns: TranscriptTurn[];
  audioUrl?: string;
}

function publicAppUrl(): string {
  return (
    process.env.VITE_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

/**
 * Generates a per-parent shareable link to an ElevenLabs ConvAI agent.
 * `shareToken` is our internal id used as a fallback when ElevenLabs is
 * not configured (so the user still gets a link they can click).
 */
export async function createConvAILink(
  agentIdOrNull: string | null,
  shareToken: string,
): Promise<AgentLinkResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const fallbackAgent = process.env.ELEVENLABS_DEFAULT_AGENT_ID;
  const agentId = agentIdOrNull ?? fallbackAgent ?? null;

  // Stub when not configured — link points to our own /assistant/:token
  // page that explains the assistant is being prepared.
  if (!apiKey || !agentId) {
    return {
      link: `${publicAppUrl()}/assistant/${shareToken}`,
      agentId: agentId ?? "stub",
      source: "stub",
    };
  }

  // ElevenLabs ConvAI public agents can be shared as
  //   https://elevenlabs.io/app/talk-to?agent_id=<agentId>
  // For private agents we'd ask for a signed URL via:
  //   GET /v1/convai/conversation/get_signed_url?agent_id=<id>
  // We try the signed-url path first; if it fails (e.g. agent is public),
  // we fall back to the public talk-to URL.
  try {
    const res = await fetch(
      `${API_BASE}/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (res.ok) {
      const data = (await res.json()) as SignedUrlResponse;
      if (data.signed_url) {
        return {
          link: data.signed_url,
          agentId,
          conversationId: data.conversation_id,
          source: "elevenlabs",
        };
      }
    }
  } catch {
    // fall through
  }

  return {
    link: `https://elevenlabs.io/app/talk-to?agent_id=${encodeURIComponent(agentId)}`,
    agentId,
    source: "elevenlabs",
  };
}

interface ConvAIMessageDTO {
  role?: string;
  message?: string;
  text?: string;
  time_in_call_secs?: number;
}

interface ConvAIConversationDTO {
  conversation_id?: string;
  status?: string;
  metadata?: { call_duration_secs?: number };
  transcript?: ConvAIMessageDTO[];
  audio_url?: string;
}

/**
 * Fetches the full transcript of a completed ConvAI conversation.
 */
export async function fetchTranscript(
  conversationId: string,
): Promise<TranscriptResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !conversationId) return null;
  const res = await fetch(
    `${API_BASE}/convai/conversations/${encodeURIComponent(conversationId)}`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as ConvAIConversationDTO;
  const turns: TranscriptTurn[] = (data.transcript ?? []).map((m) => ({
    role: m.role === "agent" ? "agent" : "user",
    text: m.message ?? m.text ?? "",
    time: m.time_in_call_secs,
  }));
  return {
    conversationId: data.conversation_id ?? conversationId,
    status: data.status ?? "completed",
    durationSeconds: data.metadata?.call_duration_secs,
    turns,
    audioUrl: data.audio_url,
  };
}

export function transcriptToMarkdown(t: TranscriptResult): string {
  const lines: string[] = [];
  for (const turn of t.turns) {
    const speaker = turn.role === "agent" ? "**Asistent**" : "**Părinte**";
    lines.push(`${speaker}: ${turn.text}`);
  }
  return lines.join("\n\n");
}

export function transcriptSummary(t: TranscriptResult): string {
  const userTurns = t.turns.filter((x) => x.role === "user").length;
  const total = t.turns.length;
  const dur = t.durationSeconds ? `${Math.round(t.durationSeconds)}s` : "—";
  return `Conversație de ${dur}, ${total} replici (${userTurns} de la părinte).`;
}
