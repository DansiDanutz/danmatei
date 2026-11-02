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

- `TabsLayout` uses `colors.brand` for the active tint and `colors.muted` for the inactive tint. It also sets `tabBarStyle` (`borderTopWidth: 0`, `elevation: 0`, `height: 64`, `paddingBottom: 8`, `paddingTop: 8`) and `tabBarLabelStyle` (`fontSize: 12`, `fontWeight: "500"`) [_layout.tsx:TabsLayout].
- `Home` (`home.tsx`): query `["profile", "me"]` with `profileService.me`.
- `Chat` (`chat.tsx`): query `["chat", "threads"]` with `chatService.listThreads`. Shows thread dates with `formatRelativeDate`.
- `Profile` (`profile.tsx`): query `["profile", "me"]`. Also uses `authService.signOut`, `useQueryClient` and `useAuthStore.reset`.
- UI components come from `@danmatei/ui`: `Card`, `Screen`, `Avatar` and `Button`.

## Invariants

- Tab headers are hidden (`headerShown: false`).
- Home and Profile use the same query key, `["profile", "me"]`, so they share cached profile data.
- Home:
  - Shows a spinner while loading, and on error an error card "Nu am putut încărca datele" with the error message (or "Eroare necunoscută" when the error is not an `Error`) and a "Reîncearcă" refetch action.
  - Otherwise shows two cards with hardcoded placeholder content: label "Următorul antrenament" with "Marți, 17:30 — Grupa U10", and label "Notificări noi" with "3 mesaje".
  - The greeting is "Bună, {fullName ?? 'antrenor'}" followed by "Iată ce e nou la academie."; it uses "antrenor" as the name when `fullName` is missing [home.tsx:Home].
- Chat:
  - Shows a spinner while loading, an error card "Eroare la încărcarea conversațiilor" with a "Reîncearcă" refetch on error, and an empty-state card "Nicio conversație încă" / "Mesajele cu antrenorii vor apărea aici." when there are no threads [chat.tsx:Chat].
  - Otherwise shows a `FlatList` keyed by `item.id`. Each row is a `Pressable` that runs `router.push` to `/chat/[id]` with params `id` and `title` ([app/chat](../chat/EGM.md)).
  - Shows the unread badge only when `unreadCount > 0`.
- Sign-out (`onSignOut`) awaits `authService.signOut()`. Only after it succeeds does it run `queryClient.clear()`, then `reset()`, then `router.replace("/onboarding")`. If `signOut` rejects (for example offline), Supabase keeps the persisted session, so the screen stays signed in, shows an `Alert` ("Deconectare eșuată" with the error message) and does not clear or navigate.
- Profile shows a spinner while `isLoading` and otherwise renders the card. It has no error state: it reads only `data` and `isLoading` from the query, so if `profileService.me` fails, `profile` is undefined and the screen shows "Utilizator" with an empty email line, with no error card and no refetch action [profile.tsx:Profile].
- Profile uses "Utilizator" as the name when `fullName` is missing, shows `profile?.email` under the name, and always passes `null` as the avatar (`uri={null}`), because `Profile` has no avatar field.
- The "Editează profilul" button (`variant="secondary"`) has an empty `onPress` handler. The sign-out button is labeled "Ieși din cont" and uses `variant="danger"`.
- The tab screens and the tab layout have no auth guard. Session gating happens only in `app/index.tsx`.

## Side Effects

- Network fetches through React Query: `profileService.me` and `chatService.listThreads`, plus a manual `refetch()`.
- Sign-out calls Supabase Auth. On success it clears the whole React Query cache (`queryClient.clear()`), resets the Zustand auth store and navigates; on failure it only shows an `Alert`.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
