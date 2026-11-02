# app/tabs

## Overview

The signed-in area of the app: a bottom-tab layout with three tabs (Home, Chat and Profile). The screens load data with React Query from `profileService` and `chatService`, and the Profile tab handles sign-out.

## Interface

- `TabsLayout` (`_layout.tsx`) declares three `Tabs.Screen` entries:

| Tab name | Title | Ionicons icon |
| --- | --- | --- |
| `home` | "Acasă" | `home` |
| `chat` | "Chat" | `chatbubbles` |
| `profile` | "Profil" | `person` |

- `TabsLayout` uses `colors.brand` for the active tint and `colors.muted` for the inactive tint.
- `Home` (`home.tsx`): query `["profile", "me"]` with `profileService.me`.
- `Chat` (`chat.tsx`): query `["chat", "threads"]` with `chatService.listThreads`. Shows thread dates with `formatRelativeDate`.
- `Profile` (`profile.tsx`): query `["profile", "me"]`. Also uses `authService.signOut`, `useQueryClient` and `useAuthStore.reset`.
- UI components come from `@danmatei/ui`: `Card`, `Screen`, `Avatar` and `Button`.

## Invariants

- Tab headers are hidden (`headerShown: false`).
- Home and Profile use the same query key, `["profile", "me"]`, so they share cached profile data.
- Home:
  - Shows a spinner while loading, and an error card with a refetch action on error.
  - Otherwise shows two cards with hardcoded placeholder content ("Marți, 17:30 — Grupa U10", "3 mesaje").
  - Uses "antrenor" as the name when `fullName` is missing.
- Chat:
  - Shows a spinner while loading, an error card with refetch on error, and an empty-state card when there are no threads.
  - Otherwise shows a `FlatList` keyed by `item.id`.
  - Shows the unread badge only when `unreadCount > 0`.
- Sign-out (`onSignOut`) awaits `authService.signOut()`. Only after it succeeds does it run `queryClient.clear()`, then `reset()`, then `router.replace("/onboarding")`. If `signOut` rejects (for example offline), Supabase keeps the persisted session, so the screen stays signed in, shows an `Alert` ("Deconectare eșuată" with the error message) and does not clear or navigate.
- Profile uses "Utilizator" as the name when `fullName` is missing, and always passes `null` as the avatar (`uri={null}`), because `Profile` has no avatar field.
- The "Editează profilul" button has an empty `onPress` handler.
- The tab screens and the tab layout have no auth guard. Session gating happens only in `app/index.tsx`.

## Side Effects

- Network fetches through React Query: `profileService.me` and `chatService.listThreads`, plus a manual `refetch()`.
- Sign-out calls Supabase Auth. On success it clears the whole React Query cache (`queryClient.clear()`), resets the Zustand auth store and navigates; on failure it only shows an `Alert`.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
