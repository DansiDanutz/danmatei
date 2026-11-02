# types

## Overview

Local TypeScript types for the chat and profile domain objects.

## Interface

- `ChatThread` (`chat.ts`): `{ id: string; title: string; updatedAt: string; unreadCount: number }`
- `ChatMessage` (`chat.ts`): `{ id: string; threadId: string; authorId: string; content: string; createdAt: string }`
- `Profile` (`profile.ts`): `{ id: string; fullName: string; email: string; role: "owner" | "super_admin" | "trainer" | "parent"; createdAt: string }`. There is no avatar field.

## Invariants

- The type system limits `Profile.role` to `"owner" | "super_admin" | "trainer" | "parent"`, the same four values as the database enum `fotbal.user_role`. Nothing checks it at runtime.
- These types are declared here. They are not imported from a shared `@danmatei/*` package.

## Side Effects

- None.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
