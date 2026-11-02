/**
 * Handler tests for the chat routes:
 *   GET  /api/chat/threads
 *   GET  /api/chat/threads/:id/messages
 *   POST /api/chat/threads/:id/messages
 *   POST /api/chat/threads/:id/read
 *
 * `userClient` is a fake query builder (tests/api/_fake-supabase.ts), so these
 * prove mapping, validation and error handling. Who may read or write which
 * thread is proved by the pgTAP tests (chat_access.test.sql,
 * chat_reads.test.sql). `serviceClient` is a spy that fails the test if called.
 *
 * checkRateLimit keeps its counters in a module-level Map that persists across
 * tests, so every test that posts uses its own user id.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OTHER_THREAD_ID,
  THREAD_ID,
  fakeDb,
  makeReq,
  makeRes,
  repeat,
} from "./_fake-supabase";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  userClient: vi.fn(),
  serviceClient: vi.fn(() => {
    throw new Error("serviceClient must not be called");
  }),
}));

vi.mock("../../api/_lib/supabase.js", async importOriginal => {
  const actual =
    await importOriginal<typeof import("../../api/_lib/supabase.js")>();
  return {
    ...actual,
    getAuthUser: mocks.getAuthUser,
    userClient: mocks.userClient,
    serviceClient: mocks.serviceClient,
  };
});

import listThreads from "../../api/chat/threads/index";
import messages from "../../api/chat/threads/[id]/messages";
import read from "../../api/chat/threads/[id]/read";

function use(responses: Parameters<typeof fakeDb>[0]) {
  const db = fakeDb(responses);
  mocks.userClient.mockReturnValue(db.client);
  return db;
}

function signIn(id: string) {
  mocks.getAuthUser.mockResolvedValue({ id, email: `${id}@example.com` });
}

const MSG = (n: number, body = `mesaj ${n}`) => ({
  id: `m${n}`,
  thread_id: THREAD_ID,
  sender_id: "u1",
  body,
  created_at: `2026-02-0${n}T10:00:00Z`,
});

describe("chat routes", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getAuthUser.mockReset();
    mocks.userClient.mockReset();
    mocks.serviceClient.mockClear();
    signIn("u1");
  });

  afterEach(() => {
    expect(mocks.serviceClient).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  describe.each([
    ["GET /api/chat/threads", listThreads, "GET", "POST", undefined],
    ["GET .../messages", messages, "GET", "DELETE", { id: THREAD_ID }],
    ["POST .../read", read, "POST", "GET", { id: THREAD_ID }],
  ] as const)(
    "%s authentication and method",
    (_name, handler, ok, bad, query) => {
      it("returns 405 for another method before authenticating", async () => {
        const { res, out } = makeRes();
        await handler(makeReq({ method: bad, query }), res);
        expect(out.status).toBe(405);
        expect(out.body).toMatchObject({ error: "method_not_allowed" });
        expect(mocks.getAuthUser).not.toHaveBeenCalled();
      });

      it("returns 401 missing_bearer without a token", async () => {
        const { res, out } = makeRes();
        await handler(makeReq({ method: ok, token: null, query }), res);
        expect(out.status).toBe(401);
        expect(out.body).toMatchObject({ error: "missing_bearer" });
        expect(mocks.userClient).not.toHaveBeenCalled();
      });

      it("returns 401 invalid_jwt when Auth rejects the token", async () => {
        mocks.getAuthUser.mockRejectedValue(new Error("Not authenticated"));
        const { res, out } = makeRes();
        await handler(makeReq({ method: ok, query }), res);
        expect(out.status).toBe(401);
        expect(out.body).toMatchObject({ error: "invalid_jwt" });
      });
    }
  );

  // -------------------------------------------------------------------------
  describe("GET /api/chat/threads", () => {
    const THREADS = [
      {
        id: "t1",
        kind: "parent_trainer",
        title: null,
        last_message_at: "2026-02-02T10:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "t2",
        kind: "parents",
        title: "Academia",
        last_message_at: null,
        created_at: "2026-01-05T00:00:00Z",
      },
    ];

    it("merges the unread counts, maps the rows and asks for the right order", async () => {
      const db = use({
        "from:chat_threads": [{ data: THREADS }],
        "rpc:chat_unread_counts": [{ data: [{ thread_id: "t1", unread: 3 }] }],
      });
      const { res, out } = makeRes();
      await listThreads(makeReq({ method: "GET" }), res);
      expect(out.status).toBe(200);
      expect(out.body).toEqual([
        {
          id: "t1",
          title: "Antrenor",
          updatedAt: "2026-02-02T10:00:00Z",
          unreadCount: 3,
        },
        {
          id: "t2",
          title: "Academia",
          updatedAt: "2026-01-05T00:00:00Z",
          unreadCount: 0,
        },
      ]);
      expect(db.calls[0].chain).toEqual([
        ["select", ["id, kind, title, last_message_at, created_at"]],
        ["order", ["last_message_at", { ascending: false, nullsFirst: false }]],
        ["order", ["created_at", { ascending: false }]],
        ["order", ["id", { ascending: false }]],
        ["limit", [100]],
      ]);
    });

    it("asks for unread counts only for the threads it returns", async () => {
      // chat_unread_counts() returns a row for every visible thread in no
      // particular order, and PostgREST caps a response at max_rows (1000), so
      // the result is filtered to the returned ids.
      const db = use({
        "from:chat_threads": [{ data: THREADS }],
        "rpc:chat_unread_counts": [{ data: [{ thread_id: "t1", unread: 3 }] }],
      });
      const { res } = makeRes();
      await listThreads(makeReq({ method: "GET" }), res);
      expect(db.calls[1].chain).toEqual([
        ["rpc", ["chat_unread_counts", undefined]],
        ["in", ["thread_id", ["t1", "t2"]]],
      ]);
    });

    it("returns an empty list without calling the unread function when there are no threads", async () => {
      const db = use({ "from:chat_threads": [{ data: [] }] });
      const { res, out } = makeRes();
      await listThreads(makeReq({ method: "GET" }), res);
      expect(out.status).toBe(200);
      expect(out.body).toEqual([]);
      expect(db.calls.map(c => c.target)).toEqual(["from:chat_threads"]);
    });

    it("returns 500, not made-up zeros, when the unread call fails", async () => {
      use({
        "from:chat_threads": [{ data: THREADS }],
        "rpc:chat_unread_counts": [
          { error: { message: "no such function", code: "42883" } },
        ],
      });
      const { res, out } = makeRes();
      await listThreads(makeReq({ method: "GET" }), res);
      expect(out.status).toBe(500);
      expect(out.body).toEqual({
        error: "server_error",
        message: "Eroare de server.",
      });
    });

    it("returns 500 when the thread query fails", async () => {
      use({
        "from:chat_threads": [{ error: { message: "boom", code: "XX000" } }],
      });
      const { res, out } = makeRes();
      await listThreads(makeReq({ method: "GET" }), res);
      expect(out.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  describe("GET /api/chat/threads/:id/messages", () => {
    it("returns 400 invalid_thread_id for a non-UUID id", async () => {
      const db = use({});
      const { res, out } = makeRes();
      await messages(makeReq({ method: "GET", query: { id: "nope" } }), res);
      expect(out.status).toBe(400);
      expect(out.body).toMatchObject({ error: "invalid_thread_id" });
      expect(db.calls).toHaveLength(0);
    });

    it("returns 404 for a thread RLS hides", async () => {
      const db = use({ "from:chat_threads": [{ data: null }] });
      const { res, out } = makeRes();
      await messages(makeReq({ method: "GET", query: { id: THREAD_ID } }), res);
      expect(out.status).toBe(404);
      expect(out.body).toMatchObject({ error: "not_found" });
      // The messages are never queried for a hidden thread.
      expect(db.calls.map(c => c.target)).toEqual(["from:chat_threads"]);
    });

    it("returns the newest 100 oldest first, in the mobile shape", async () => {
      const db = use({
        "from:chat_threads": [{ data: { id: THREAD_ID } }],
        "from:chat_messages": [{ data: [MSG(2), MSG(1)] }],
      });
      const { res, out } = makeRes();
      await messages(makeReq({ method: "GET", query: { id: THREAD_ID } }), res);
      expect(out.status).toBe(200);
      expect(out.body).toEqual([
        {
          id: "m1",
          threadId: THREAD_ID,
          authorId: "u1",
          content: "mesaj 1",
          createdAt: "2026-02-01T10:00:00Z",
        },
        {
          id: "m2",
          threadId: THREAD_ID,
          authorId: "u1",
          content: "mesaj 2",
          createdAt: "2026-02-02T10:00:00Z",
        },
      ]);
      expect(db.calls[1].chain).toEqual([
        ["select", ["id, thread_id, sender_id, body, created_at"]],
        ["eq", ["thread_id", THREAD_ID]],
        ["order", ["created_at", { ascending: false }]],
        ["order", ["id", { ascending: false }]],
        ["limit", [100]],
      ]);
    });

    it("returns 500 when the thread or message query fails", async () => {
      use({
        "from:chat_threads": [{ error: { message: "boom", code: "XX000" } }],
      });
      let r = makeRes();
      await messages(
        makeReq({ method: "GET", query: { id: THREAD_ID } }),
        r.res
      );
      expect(r.out.status).toBe(500);

      use({
        "from:chat_threads": [{ data: { id: THREAD_ID } }],
        "from:chat_messages": [{ error: { message: "boom", code: "XX000" } }],
      });
      r = makeRes();
      await messages(
        makeReq({ method: "GET", query: { id: THREAD_ID } }),
        r.res
      );
      expect(r.out.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  describe("POST /api/chat/threads/:id/messages", () => {
    it("returns 400 invalid_thread_id for a non-UUID id", async () => {
      use({});
      const { res, out } = makeRes();
      await messages(
        makeReq({
          method: "POST",
          query: { id: "nope" },
          body: { content: "x" },
        }),
        res
      );
      expect(out.status).toBe(400);
      expect(out.body).toMatchObject({ error: "invalid_thread_id" });
    });

    it.each([
      ["empty", { content: "" }],
      ["whitespace", { content: "   " }],
      ["4001 characters", { content: "x".repeat(4001) }],
      ["no content", {}],
      ["not an object", "x"],
    ])("rejects %s content with 400 invalid_body", async (_label, body) => {
      signIn("u-invalid");
      const db = use({});
      const { res, out } = makeRes();
      await messages(
        makeReq({ method: "POST", query: { id: THREAD_ID }, body }),
        res
      );
      expect(out.status).toBe(400);
      expect(out.body).toMatchObject({ error: "invalid_body" });
      expect(db.calls).toHaveLength(0);
    });

    it("inserts as the caller, ignores a senderId in the body, and returns 201", async () => {
      signIn("u-sender");
      const db = use({
        "from:chat_messages": [
          { data: { ...MSG(3), sender_id: "u-sender", body: "Salut" } },
        ],
      });
      const { res, out } = makeRes();
      await messages(
        makeReq({
          method: "POST",
          query: { id: THREAD_ID },
          body: { content: "  Salut ", senderId: "attacker" },
        }),
        res
      );
      expect(out.status).toBe(201);
      expect(out.body).toEqual({
        id: "m3",
        threadId: THREAD_ID,
        authorId: "u-sender",
        content: "Salut",
        createdAt: "2026-02-03T10:00:00Z",
      });
      expect(db.calls[0].chain).toEqual([
        [
          "insert",
          [{ thread_id: THREAD_ID, sender_id: "u-sender", body: "Salut" }],
        ],
        ["select", ["id, thread_id, sender_id, body, created_at"]],
        ["single", []],
      ]);
    });

    it("maps an RLS violation (42501) to 404, the same as a missing thread", async () => {
      signIn("u-rls");
      use({
        "from:chat_messages": [{ error: { message: "rls", code: "42501" } }],
      });
      const { res, out } = makeRes();
      await messages(
        makeReq({
          method: "POST",
          query: { id: OTHER_THREAD_ID },
          body: { content: "x" },
        }),
        res
      );
      expect(out.status).toBe(404);
      expect(out.body).toMatchObject({ error: "not_found" });
    });

    it("maps any other database error, including 23503, to 500", async () => {
      signIn("u-fk");
      use({
        "from:chat_messages": [{ error: { message: "fk", code: "23503" } }],
      });
      const { res, out } = makeRes();
      await messages(
        makeReq({
          method: "POST",
          query: { id: THREAD_ID },
          body: { content: "x" },
        }),
        res
      );
      expect(out.status).toBe(500);
      expect(out.body).toEqual({
        error: "server_error",
        message: "Eroare de server.",
      });
    });

    it("returns 429 with Retry-After after 30 messages in a minute", async () => {
      signIn("u-flood");
      use({ "from:chat_messages": repeat({ data: MSG(1) }, 31) });
      for (let i = 0; i < 30; i++) {
        const { res, out } = makeRes();
        await messages(
          makeReq({
            method: "POST",
            query: { id: THREAD_ID },
            body: { content: "x" },
          }),
          res
        );
        expect(out.status).toBe(201);
      }
      const { res, out } = makeRes();
      await messages(
        makeReq({
          method: "POST",
          query: { id: THREAD_ID },
          body: { content: "x" },
        }),
        res
      );
      expect(out.status).toBe(429);
      expect(out.body).toMatchObject({ error: "rate_limited" });
      expect(Number(out.headers["Retry-After"])).toBeGreaterThan(0);
      expect(Number(out.headers["Retry-After"])).toBeLessThanOrEqual(60);
    });

    it("counts the limit per user, not across users", async () => {
      signIn("u-other-user");
      use({ "from:chat_messages": [{ data: MSG(1) }] });
      const { res, out } = makeRes();
      await messages(
        makeReq({
          method: "POST",
          query: { id: THREAD_ID },
          body: { content: "x" },
        }),
        res
      );
      expect(out.status).toBe(201);
    });
  });

  // -------------------------------------------------------------------------
  describe("POST /api/chat/threads/:id/read", () => {
    it("returns 400 invalid_thread_id for a non-UUID id", async () => {
      const db = use({});
      const { res, out } = makeRes();
      await read(makeReq({ method: "POST", query: { id: "nope" } }), res);
      expect(out.status).toBe(400);
      expect(out.body).toMatchObject({ error: "invalid_thread_id" });
      expect(db.calls).toHaveLength(0);
    });

    it("calls chat_mark_read and returns 204 with no body, without reading the request body", async () => {
      const db = use({ "rpc:chat_mark_read": [{ data: null }] });
      const req = makeReq({ method: "POST", query: { id: THREAD_ID } });
      Object.defineProperty(req, "body", {
        get() {
          throw new Error("the read route must not read req.body");
        },
      });
      const { res, out } = makeRes();
      await read(req, res);
      expect(out.status).toBe(204);
      expect(out.ended).toBe(true);
      expect(out.body).toBeUndefined();
      expect(db.calls[0].chain).toEqual([
        ["rpc", ["chat_mark_read", { p_thread: THREAD_ID }]],
      ]);
    });

    it("maps 42501 (hidden or nonexistent thread) to 404", async () => {
      use({
        "rpc:chat_mark_read": [{ error: { message: "rls", code: "42501" } }],
      });
      const { res, out } = makeRes();
      await read(
        makeReq({ method: "POST", query: { id: OTHER_THREAD_ID } }),
        res
      );
      expect(out.status).toBe(404);
      expect(out.body).toMatchObject({ error: "not_found" });
    });

    it("maps any other error to 500", async () => {
      use({
        "rpc:chat_mark_read": [{ error: { message: "boom", code: "XX000" } }],
      });
      const { res, out } = makeRes();
      await read(makeReq({ method: "POST", query: { id: THREAD_ID } }), res);
      expect(out.status).toBe(500);
      expect(out.body).toMatchObject({ error: "server_error" });
    });
  });
});
