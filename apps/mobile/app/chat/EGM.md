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
- The screen shows a spinner while loading, an error card ("Eroare la încărcarea mesajelor") with a "Reîncearcă" refetch on error, and an empty-state card ("Niciun mesaj încă" / "Scrie primul mesaj mai jos.") when there are no messages [[id].tsx:ChatThreadScreen].
- Send validation: `messageSchema` trims the text and requires 1 to 4000 characters. The errors "Scrie un mesaj" and "Mesajul poate avea cel mult 4000 de caractere" show under the `Input`, and an empty or whitespace-only submit never reaches `send` [features/chat/schemas.ts:messageSchema]. The input placeholder is "Scrie un mesaj" and the send button is "Trimite".
- A successful send clears the input only if its text is unchanged since submit; text typed while the send was pending is kept. A failed send (including 429 `rate_limited`) shows an `Alert` titled "Mesajul nu a fost trimis" with the server's message (or "Încearcă din nou." when the error is not an `Error`) and keeps the text.
- `markRead` is called once, after the messages have loaded. The header shows `title`, or "Conversație" when the param is missing.
- The list has no live updates or polling: new messages from others appear after leaving and re-opening the thread. Only the newest 100 messages are loaded.
- The screen is wrapped in `KeyboardAvoidingView`, with `behavior="padding"` on iOS only and no behavior on other platforms [[id].tsx:ChatThreadScreen].
- On Expo Web the `/api` routes answer the browser's preflight and send CORS headers only for the Expo Web dev origins and `MOBILE_WEB_ORIGINS` ([api/_lib](../../../../api/_lib/EGM.md)). A deployed web build must have its origin in that variable.

## Side Effects

- `GET /api/chat/threads/:id/messages`, `POST` of a message, and `POST .../read`, through `chatService`.
- Updates the React Query cache for the thread list and the message list.
- `router.back()` on the "Înapoi" press.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
