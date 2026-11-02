# features/chat

## Overview

A thin REST client for chat threads and messages. It is built on `api` from `lib/api.ts`.

## Interface

- `chatService.listThreads()`: `GET /api/chat/threads`, returns `ChatThread[]`.
- `chatService.getMessages(threadId)`: `GET /api/chat/threads/${threadId}/messages`, returns `ChatMessage[]`.
- `chatService.sendMessage(threadId, content)`: `POST /api/chat/threads/${threadId}/messages` with body `{ content }`, returns `ChatMessage`.
- `ChatThread` and `ChatMessage` come from `@/types/chat`.

## Invariants

- No server handler for `/api/chat/threads` or `/api/chat/threads/:id/messages` exists in this repo (`api/` has no `chat/` folder), so these calls have no backend here.
- `threadId` is inserted into the path without URL encoding.
- Responses are cast to the generic type. Nothing validates them at runtime.

## Side Effects

- Sends HTTP requests to `config.apiBaseUrl` through `api`. Requests carry the Supabase bearer token when a session exists.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
