# types

## Overview

Local TypeScript types for the chat and profile domain objects.

## Interface

- `ChatThread` (`chat.ts`): `{ id: string; title: string; updatedAt: string; unreadCount: number }`
- `ChatMessage` (`chat.ts`): `{ id: string; threadId: string; authorId: string; content: string; createdAt: string }`
- `Profile` (`profile.ts`): `{ id: string; fullName: string; email: string; role: "parent" | "trainer" | "admin" | "player"; avatarUrl: string | null; createdAt: string }`

## Invariants

- The type system limits `Profile.role` to `"parent" | "trainer" | "admin" | "player"`. Nothing checks it at runtime.
- These types are declared here. They are not imported from a shared `@danmatei/*` package.

## Side Effects

- None.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
