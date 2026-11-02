# features/chat

## Overview

A thin REST client for chat threads and messages. It is built on `api` from `lib/api.ts`.

## Interface

- `chatService.listThreads()`: `GET /api/chat/threads`, returns `ChatThread[]`.
- `chatService.getMessages(threadId)`: `GET /api/chat/threads/${threadId}/messages`, returns `ChatMessage[]`.
- `chatService.sendMessage(threadId, content)`: `POST /api/chat/threads/${threadId}/messages` with body `{ content }`, returns `ChatMessage`.
- `chatService.markRead(threadId)`: `POST /api/chat/threads/${threadId}/read` with no body, resolves to `void` (the server answers 204).
- `ChatThread` and `ChatMessage` come from `@/types/chat`.
- `useThread(threadId)` (`use-thread.ts`): returns `{ messages, send }`.
  - `messages` is a `useQuery` on `messagesKey(threadId)` = `["chat", "threads", threadId, "messages"]` with `getMessages`.
  - `send` is a `useMutation` that calls `sendMessage`. On success it appends the returned message to the cached list and invalidates the thread list (`["chat", "threads"]`, exact) so the thread moves to the top.
  - On mount, and when `threadId` changes, it calls `markRead` once. On success it sets `unreadCount` to 0 for that thread in the cached list. A failure is silent: the badge stays and the next open tries again.
- `messageSchema` (`schemas.ts`): `{ content }`, trimmed, 1 to 4000 characters, Romanian messages. Same limits as the server.
- `appendMessage`, `clearUnread`, `threadsKey`, `messagesKey` (`cache.ts`): pure cache helpers. `appendMessage` ignores a message whose id is already cached.
- `MessageBubble` (`MessageBubble.tsx`): one message; right-aligned and brand-colored when `mine`.

## Invariants

- The routes are served by [api/chat](../../../../../api/chat/EGM.md):
  - `listThreads` gets up to 100 threads that RLS lets the caller see, most recent message first, each with `unreadCount`.
  - `getMessages` gets the newest 100 messages of the thread, oldest first, and returns 404 for a thread the caller cannot see.
  - `sendMessage` returns 201 with the new message. The server sets the sender to the caller, trims `content` and requires 1 to 4000 characters. It answers 429 after 30 posts in a minute.
  - `markRead` records a read for the caller and returns 404 for a thread the caller cannot see.
- Callers: `listThreads` is used by the Chat tab; `getMessages`, `sendMessage` and `markRead` are used by `useThread`, which the thread screen ([app/chat](../../../app/chat/EGM.md)) calls.
- `threadId` is inserted into the path without URL encoding.
- Responses are cast to the generic type. Nothing validates them at runtime.

## Side Effects

- Sends HTTP requests to `config.apiBaseUrl` through `api`. Requests carry the Supabase bearer token when a session exists.
- `useThread` writes to the React Query cache (appends a sent message, zeroes a thread's unread count).

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
- Run: `pnpm test tests/mobile-chat-thread.test.ts` (schema and cache helpers)
