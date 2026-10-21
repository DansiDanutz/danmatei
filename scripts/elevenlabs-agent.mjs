/**
 * Create or update the AI interview agent (Andra) on ElevenLabs from
 * services/elevenlabs-agent/agent.json + prompt.ro.md, and wire its post-call
 * webhook to /api/voice/elevenlabs-webhook.
 *
 *   ELEVENLABS_API_KEY=... node scripts/elevenlabs-agent.mjs            # create agent + webhook
 *   ELEVENLABS_API_KEY=... ELEVENLABS_INTERVIEW_AGENT_ID=agent_... \
 *     ELEVENLABS_POST_CALL_WEBHOOK_ID=... node scripts/elevenlabs-agent.mjs   # update in place
 *   node scripts/elevenlabs-agent.mjs --dry-run                          # print the request body
 *
 * The API key needs Conversational AI (agents) and workspace webhook write
 * access. A newly created webhook's signing secret is written to
 * services/elevenlabs-agent/.output.local.json (gitignored), never printed:
 * set it as ELEVENLABS_WEBHOOK_SECRET on Vercel, and the agent id as
 * ELEVENLABS_INTERVIEW_AGENT_ID.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.elevenlabs.io/v1";
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "services", "elevenlabs-agent");
const WEBHOOK_URL =
  process.env.ELEVENLABS_POST_CALL_WEBHOOK_URL ??
  "https://www.danmatei.ro/api/voice/elevenlabs-webhook";

export function buildAgentBody(dir = DIR) {
  const config = JSON.parse(readFileSync(join(dir, "agent.json"), "utf8"));
  const prompt = config.conversation_config.agent.prompt;
  if (prompt.prompt === "@prompt.ro.md") {
    prompt.prompt = readFileSync(join(dir, "prompt.ro.md"), "utf8");
  }
  return config;
}

async function call(method, path, apiKey, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "xi-api-key": apiKey, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function main() {
  const body = buildAgentBody();
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required");
  const output = {};

  let webhookId = process.env.ELEVENLABS_POST_CALL_WEBHOOK_ID;
  if (!webhookId) {
    const created = await call("POST", "/workspace/webhooks", apiKey, {
      settings: {
        auth_type: "hmac",
        name: "danmatei — interview post-call",
        webhook_url: WEBHOOK_URL,
      },
    });
    webhookId = created.webhook_id;
    output.ELEVENLABS_POST_CALL_WEBHOOK_ID = webhookId;
    if (created.webhook_secret) {
      output.ELEVENLABS_WEBHOOK_SECRET = created.webhook_secret;
    }
    console.log(`Created post-call webhook ${webhookId} → ${WEBHOOK_URL}`);
  }

  body.platform_settings.workspace_overrides = {
    webhooks: { post_call_webhook_id: webhookId, events: ["transcript"] },
  };

  let agentId = process.env.ELEVENLABS_INTERVIEW_AGENT_ID;
  if (agentId) {
    await call("PATCH", `/convai/agents/${agentId}`, apiKey, body);
    console.log(`Updated agent ${agentId}`);
  } else {
    const created = await call("POST", "/convai/agents/create", apiKey, body);
    agentId = created.agent_id;
    console.log(`Created agent ${agentId}`);
  }
  output.ELEVENLABS_INTERVIEW_AGENT_ID = agentId;

  // Merge with earlier runs: an update run has no new webhook secret to save
  // and must not drop the one recorded when the webhook was created.
  const outFile = join(DIR, ".output.local.json");
  const previous = existsSync(outFile)
    ? JSON.parse(readFileSync(outFile, "utf8"))
    : {};
  writeFileSync(
    outFile,
    JSON.stringify({ ...previous, ...output }, null, 2) + "\n"
  );
  console.log(
    `Wrote ${Object.keys(output).join(", ")} to ${outFile} — set them on Vercel (production).`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
