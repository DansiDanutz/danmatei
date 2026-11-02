# api/chat

## Overview
Blueprint contract. This directory has no source files of its own. It holds the chat routes the mobile app calls, served under `/api/chat/`. All of them use the shared plumbing in [api/_lib](../_lib/EGM.md) (`mobile-api.ts`), query only through the RLS-scoped `userClient`, and never use the service client.

## Subdirectories
- [`threads/`](./threads/EGM.md) - `GET /api/chat/threads`: the caller's thread list with unread counts. Its child [`threads/[id]/`](./threads/[id]/EGM.md) holds the per-thread routes: `GET` and `POST /api/chat/threads/:id/messages` and `POST /api/chat/threads/:id/read`.
