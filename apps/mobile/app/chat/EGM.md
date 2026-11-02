# app/chat

## Overview

The chat thread screen. The Chat tab opens it when the user taps a thread. It lists the thread's messages, sends a new one, and marks the thread read on open. It is a Stack route outside the tabs, so the tab bar is hidden.

## Interface

| Route | Default export | Params |
| --- | --- | --- |
| `/chat/[id]` | `ChatThreadScreen` | `id` (thread id), `title` (optional, shown in the header) |

- Data and mutations come from `useThread` in [features/chat](../../src/features/chat/EGM.md). The send form is react-hook-form with `messageSchema`.
- UI: `Screen`, `Card`, `Input`, `Button` from `@danmatei/ui`, and `MessageBubble`.

## Invariants

- Messages are shown newest at the bottom: the list is an inverted `FlatList` over the cached oldest-first array, reversed.
- A message is "mine" when `authorId` equals `useAuthStore` `user.id`.
- The screen shows a spinner while loading, an error card with a "Reîncearcă" refetch on error, and an empty-state card when there are no messages.
- A successful send clears the input only if its text is unchanged since submit; text typed while the send was pending is kept. A failed send (including 429 `rate_limited`) shows an `Alert` with the server's message and keeps the text.
- `markRead` is called once, after the messages have loaded. The header shows `title`, or "Conversație" when the param is missing.
- The list has no live updates or polling: new messages from others appear after leaving and re-opening the thread. Only the newest 100 messages are loaded.
- On Expo Web the `/api` routes answer the browser's preflight and send CORS headers only for the Expo Web dev origins and `MOBILE_WEB_ORIGINS` ([api/_lib](../../../../api/_lib/EGM.md)). A deployed web build must have its origin in that variable.

## Side Effects

- `GET /api/chat/threads/:id/messages`, `POST` of a message, and `POST .../read`, through `chatService`.
- Updates the React Query cache for the thread list and the message list.
- `router.back()` on the "Înapoi" press.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
