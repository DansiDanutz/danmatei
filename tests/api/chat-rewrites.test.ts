/**
 * Guard for the chat routes that take a thread id in the path.
 *
 * A bracket-named function file (`api/chat/threads/[id]/messages.ts`) did not
 * resolve on Vercel: GET returned the SPA's index.html and POST returned 405,
 * because the generic rewrites in vercel.json took the request first. The id
 * routes are therefore plain files, reached through explicit rewrites that must
 * come BEFORE the generic `/api/(.*)` rewrite (the first matching rewrite wins).
 * The mobile app keeps calling /api/chat/threads/:id/messages and .../read.
 *
 * This test cannot run Vercel's router, but it fails if a rewrite is removed or
 * reordered, if its destination file goes missing, or if the mobile client's
 * URLs stop matching the sources. A request that resolves on the live site
 * answers JSON 401 without a token; the SPA's HTML means it did not.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Rewrite = { source: string; destination: string };

const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  rewrites: Rewrite[];
};
const chatService = readFileSync(
  "apps/mobile/src/features/chat/chat-service.ts",
  "utf8"
);

const ID_ROUTES = [
  {
    source: "/api/chat/threads/:id/messages",
    destination: "/api/chat/thread-messages?id=:id",
    file: "api/chat/thread-messages.ts",
    mobilePath: "/api/chat/threads/${threadId}/messages",
  },
  {
    source: "/api/chat/threads/:id/read",
    destination: "/api/chat/thread-read?id=:id",
    file: "api/chat/thread-read.ts",
    mobilePath: "/api/chat/threads/${threadId}/read",
  },
];

describe("chat routes with a thread id in the path", () => {
  const generic = vercel.rewrites.findIndex(r => r.source === "/api/(.*)");
  const spa = vercel.rewrites.findIndex(r => r.source === "/(.*)");

  it("keeps the generic /api and SPA rewrites, SPA last", () => {
    expect(generic).toBeGreaterThanOrEqual(0);
    expect(spa).toBe(vercel.rewrites.length - 1);
  });

  it.each(ID_ROUTES)(
    "rewrites $source to $destination, before the generic /api rewrite",
    ({ source, destination }) => {
      const i = vercel.rewrites.findIndex(r => r.source === source);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(vercel.rewrites[i].destination).toBe(destination);
      expect(i).toBeLessThan(generic);
    }
  );

  it.each(ID_ROUTES)("has the function file $file", ({ file }) => {
    expect(existsSync(file)).toBe(true);
  });

  it.each(ID_ROUTES)(
    "matches the URL the mobile client calls ($mobilePath)",
    ({ mobilePath }) => {
      expect(chatService).toContain(mobilePath);
    }
  );

  it("has no bracket-named route files under api/chat", () => {
    expect(existsSync("api/chat/threads/[id]")).toBe(false);
  });
});
