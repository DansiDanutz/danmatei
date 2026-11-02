/**
 * Unit tests for the pure helpers in api/_lib/mobile-api.ts: the body parsers,
 * thread-id parsing and the mappers from database rows to the mobile shapes.
 *
 * The mapper tests assert the exact field sets with toEqual, so a column that
 * leaks into a response (such as `kind` or `created_at`) fails here.
 */
import { describe, expect, it } from "vitest";
import {
  mapMessage,
  mapProfile,
  mapThread,
  parseMessageBody,
  parseProfileUpdate,
  readThreadId,
} from "../../api/_lib/mobile-api";

describe("parseProfileUpdate", () => {
  it("accepts only fullName, trimmed", () => {
    expect(parseProfileUpdate({ fullName: "  Dan Matei " })).toEqual({
      ok: true,
      fullName: "Dan Matei",
    });
  });

  it.each(["role", "email", "id", "createdAt", "avatarUrl"])(
    "rejects %s even beside a valid fullName",
    key => {
      expect(parseProfileUpdate({ fullName: "Dan Matei", [key]: "x" })).toEqual(
        {
          ok: false,
          error: "forbidden_fields",
          keys: [key],
        }
      );
    }
  );

  it("lists every rejected key", () => {
    expect(
      parseProfileUpdate({
        fullName: "Dan Matei",
        role: "owner",
        email: "a@b.c",
      })
    ).toEqual({
      ok: false,
      error: "forbidden_fields",
      keys: ["role", "email"],
    });
  });

  it.each([null, undefined, [], ["fullName"], "fullName", 7])(
    "rejects a body that is not a plain object (%j)",
    body => {
      expect(parseProfileUpdate(body)).toEqual({
        ok: false,
        error: "invalid_body",
      });
    }
  );

  it("trims before checking the length (2 to 120)", () => {
    expect(parseProfileUpdate({ fullName: " a " }).ok).toBe(false);
    expect(parseProfileUpdate({ fullName: "ab" }).ok).toBe(true);
    expect(parseProfileUpdate({ fullName: "x".repeat(120) }).ok).toBe(true);
    expect(parseProfileUpdate({ fullName: "x".repeat(121) }).ok).toBe(false);
    expect(parseProfileUpdate({ fullName: 5 }).ok).toBe(false);
    expect(parseProfileUpdate({}).ok).toBe(false);
  });
});

describe("parseMessageBody", () => {
  it("trims the content", () => {
    expect(parseMessageBody({ content: "  Salut  " })).toEqual({
      ok: true,
      content: "Salut",
    });
  });

  it("ignores other keys such as a senderId", () => {
    expect(parseMessageBody({ content: "x", senderId: "attacker" })).toEqual({
      ok: true,
      content: "x",
    });
  });

  it("rejects empty, whitespace-only and over-long content", () => {
    expect(parseMessageBody({ content: "" }).ok).toBe(false);
    expect(parseMessageBody({ content: "   " }).ok).toBe(false);
    expect(parseMessageBody({ content: "x".repeat(4000) }).ok).toBe(true);
    expect(parseMessageBody({ content: "x".repeat(4001) }).ok).toBe(false);
  });

  it("rejects bodies that are not an object with a string content", () => {
    for (const body of [null, undefined, [], "x", { content: 1 }, {}]) {
      expect(parseMessageBody(body).ok).toBe(false);
    }
  });
});

describe("readThreadId", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("returns a single UUID string", () => {
    expect(readThreadId({ query: { id } })).toBe(id);
  });

  it("returns null for an array, a missing id and a non-UUID", () => {
    expect(readThreadId({ query: { id: [id, id] } })).toBeNull();
    expect(readThreadId({ query: {} })).toBeNull();
    expect(readThreadId({})).toBeNull();
    expect(readThreadId({ query: { id: "not-a-uuid" } })).toBeNull();
    expect(readThreadId({ query: { id: `${id}x` } })).toBeNull();
  });
});

describe("mappers", () => {
  it("mapProfile returns exactly id, fullName, email, role and createdAt", () => {
    expect(
      mapProfile(
        {
          id: "u1",
          full_name: "Dan Matei",
          role: "owner",
          created_at: "2026-01-01T00:00:00Z",
          phone: "leak",
        },
        "dan@example.com"
      )
    ).toEqual({
      id: "u1",
      fullName: "Dan Matei",
      email: "dan@example.com",
      role: "owner",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("mapThread returns exactly id, title, updatedAt and unreadCount", () => {
    expect(
      mapThread(
        {
          id: "t1",
          kind: "parent_trainer",
          title: "Echipa U11",
          last_message_at: "2026-02-01T10:00:00Z",
          created_at: "2026-01-01T00:00:00Z",
        },
        4
      )
    ).toEqual({
      id: "t1",
      title: "Echipa U11",
      updatedAt: "2026-02-01T10:00:00Z",
      unreadCount: 4,
    });
  });

  it.each([
    ["parent_trainer", "Antrenor"],
    ["group", "Grupa"],
    ["parents", "Părinți"],
  ])("mapThread titles an untitled %s thread %s", (kind, title) => {
    expect(
      mapThread(
        { id: "t", kind, title: null, last_message_at: null, created_at: "c" },
        0
      ).title
    ).toBe(title);
  });

  it("mapThread falls back to created_at when there are no messages", () => {
    expect(
      mapThread(
        {
          id: "t",
          kind: "group",
          title: null,
          last_message_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
        0
      ).updatedAt
    ).toBe("2026-01-01T00:00:00Z");
  });

  it("mapMessage renames thread_id, sender_id and body", () => {
    expect(
      mapMessage({
        id: "m1",
        thread_id: "t1",
        sender_id: "u1",
        body: "Salut",
        created_at: "2026-02-01T10:00:00Z",
        edited_at: null,
      })
    ).toEqual({
      id: "m1",
      threadId: "t1",
      authorId: "u1",
      content: "Salut",
      createdAt: "2026-02-01T10:00:00Z",
    });
  });
});
