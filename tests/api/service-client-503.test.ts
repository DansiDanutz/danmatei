/**
 * `serviceClient()` throws when SUPABASE_SERVICE_ROLE (or the URL) is missing,
 * and `userClient()` throws when the URL or anon key is missing. These handlers
 * used to let that escape as an uncaught platform 500; like the other handlers
 * they now answer 503 `supabase_unavailable`.
 *
 * Each handler is also run with a working service client, so the 503 cannot be
 * an unconditional response.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./_fake-supabase";

const state = vi.hoisted(() => ({
  serviceThrows: true,
  userThrows: false,
  service: undefined as unknown,
  user: undefined as unknown,
}));
const createConvAILink = vi.hoisted(() => vi.fn());

vi.mock("../../api/_lib/supabase.js", async importActual => ({
  ...(await importActual<object>()),
  getJwtFromHeader: (h?: string) => h?.replace(/^Bearer\s+/i, "") || null,
  getUserIdFromJwt: async () => "user-1",
  serviceClient: () => {
    if (state.serviceThrows) {
      throw new Error("SUPABASE_SERVICE_ROLE is not set");
    }
    return state.service;
  },
  userClient: () => {
    if (state.userThrows) throw new Error("SUPABASE_ANON_KEY is not set");
    return state.user;
  },
}));
vi.mock("../../api/_lib/elevenlabs.js", async importActual => ({
  ...(await importActual<object>()),
  createConvAILink,
}));

import startConversation from "../../api/ai/start-conversation";
import pushSubscribe from "../../api/push/subscribe";
import pushUnsubscribe from "../../api/push/unsubscribe";
import sendWelcome from "../../api/whatsapp/send-welcome";

const CHILD = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function run(
  handler: (req: any, res: any) => Promise<unknown>,
  body: unknown,
  extra: { method?: string } = {}
) {
  const out = { status: 0, body: undefined as any };
  const res = {
    status(n: number) {
      out.status = n;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
    setHeader() {},
    end() {},
  };
  return handler(
    {
      method: extra.method ?? "POST",
      headers: { authorization: "Bearer token" },
      body,
    },
    res
  ).then(() => out);
}

const subscription = {
  endpoint: "https://push.example/abc",
  keys: { p256dh: "p".repeat(20), auth: "a".repeat(20) },
};

beforeEach(() => {
  state.serviceThrows = true;
  state.userThrows = false;
  state.service = undefined;
  state.user = undefined;
  createConvAILink.mockReset();
  createConvAILink.mockResolvedValue({
    link: "https://l.example",
    agentId: null,
    conversationId: null,
    source: "stub",
  });
});

describe("a missing service role answers 503 supabase_unavailable", () => {
  const expected = (r: { status: number; body: any }) => {
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("supabase_unavailable");
    expect(r.body.message).toContain("SUPABASE_SERVICE_ROLE");
  };

  it("push/subscribe", async () => {
    expected(await run(pushSubscribe, subscription));
  });

  it("push/unsubscribe", async () => {
    expected(await run(pushUnsubscribe, { endpoint: subscription.endpoint }));
  });

  it("whatsapp/send-welcome", async () => {
    state.user = fakeDb({
      "from:children": [
        {
          data: {
            id: CHILD,
            full_name: "Copil",
            trainer_id: null,
            assignment_status: "accepted",
            parent: { id: "parent-503", full_name: "Ana Pop", phone: "+4071" },
            trainer: null,
          },
        },
      ],
    }).client;
    expected(await run(sendWelcome, { childId: CHILD }));
  });

  it("ai/start-conversation, before the ElevenLabs link is created", async () => {
    state.user = fakeDb({
      "from:profiles": [{ data: { id: "profile-503" } }],
    }).client;
    expected(await run(startConversation, {}));
    expect(createConvAILink).not.toHaveBeenCalled();
  });
});

describe("with a working service client the handlers carry on", () => {
  it("push/subscribe reaches its own database error handling", async () => {
    state.serviceThrows = false;
    state.service = fakeDb({
      "from:push_subscriptions": [{ error: { message: "db down" } }],
    }).client;
    const r = await run(pushSubscribe, subscription);
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "db down" });
  });

  it("push/unsubscribe reaches its own database error handling", async () => {
    state.serviceThrows = false;
    state.service = fakeDb({
      "from:push_subscriptions": [{ error: { message: "db down" } }],
    }).client;
    const r = await run(pushUnsubscribe, { endpoint: subscription.endpoint });
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "db down" });
  });

  it("whatsapp/send-welcome reaches the claim", async () => {
    state.serviceThrows = false;
    state.user = fakeDb({
      "from:children": [
        {
          data: {
            id: CHILD,
            full_name: "Copil",
            trainer_id: null,
            assignment_status: "accepted",
            parent: { id: "parent-ok", full_name: "Ana Pop", phone: null },
            trainer: null,
          },
        },
      ],
    }).client;
    state.service = fakeDb({
      "from:children": [{ error: { message: "claim failed" } }],
    }).client;
    const r = await run(sendWelcome, { childId: CHILD });
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "claim failed" });
  });

  it("ai/start-conversation creates the link and inserts", async () => {
    state.serviceThrows = false;
    state.user = fakeDb({
      "from:profiles": [{ data: { id: "profile-ok" } }],
    }).client;
    state.service = fakeDb({
      "from:ai_conversations": [{ error: { message: "insert failed" } }],
    }).client;
    const r = await run(startConversation, {});
    expect(createConvAILink).toHaveBeenCalledTimes(1);
    expect(r.status).toBe(500);
  });
});

describe("a missing anon key or URL answers 503 supabase_unavailable", () => {
  beforeEach(() => {
    state.userThrows = true;
  });

  it("whatsapp/send-welcome", async () => {
    const r = await run(sendWelcome, { childId: CHILD });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("supabase_unavailable");
    expect(r.body.message).toContain("SUPABASE_ANON_KEY");
  });

  it("ai/start-conversation, before the ElevenLabs link is created", async () => {
    const r = await run(startConversation, {});
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("supabase_unavailable");
    expect(r.body.message).toContain("SUPABASE_ANON_KEY");
    expect(createConvAILink).not.toHaveBeenCalled();
  });
});
