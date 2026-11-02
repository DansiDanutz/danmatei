# notifications

## Overview

Header notification bell for signed-in members (rendered by `client/src/components/MemberShell.tsx`). It lists the user's in-app notifications with live updates and provides a Web Push opt-in toggle.

## Interface

- `NotificationBell` (default, no props) - unread badge, popover list, and mark one or all as read. Uses `useAuth().profile` and `usePushSubscription()` from `client/src/lib` [NotificationBell.tsx:NotificationBell]
- `PushToggle` (internal) - calls `subscribe()` / `unsubscribe()` [NotificationBell.tsx:PushToggle]

## Invariants

- Does not fetch notifications or open the realtime channel while `profile` is null [NotificationBell.tsx:fetchItems]
- Calls `usePushSubscription()` on every mount, whether or not the popover is open and even while `profile` is null. That hook re-subscribes automatically when the browser permission is already `granted` and the user has not opted out [NotificationBell.tsx:NotificationBell; client/src/lib/use-push-subscription.ts]
- The list holds at most 30 items, newest first. Realtime inserts are prepended and the list is trimmed back to 30 [NotificationBell.tsx:fetchItems]
- Unread means `read_at IS NULL`. The badge shows `9+` above 9 [NotificationBell.tsx:unreadCount]
- `PushToggle` hides itself for push status `checking`, `unsupported` and `not-configured`, and shows a blocked message for `denied` [NotificationBell.tsx:PushToggle]

## Side Effects

- Supabase read `notifications` filtered by `recipient_id = profile.id` [NotificationBell.tsx:fetchItems]
- Supabase update `notifications.read_at` for one row, or for all of the user's unread rows (`recipient_id = profile.id` and `read_at IS NULL`), including rows outside the local 30-item list [NotificationBell.tsx:markRead, markAllRead]
- Realtime channel `notifications-realtime`: INSERT events on `fotbal.notifications` filtered by `recipient_id`; the channel is removed on cleanup
- Sets `window.location.href` to a notification's `link` when it is clicked
- Push subscription side effects are implemented in `client/src/lib/use-push-subscription.ts`

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
