# Mobile Backend for Profile and Chat

*   **Author:** Semenescu Dan (DansiDanutz)
*   **Status:** Draft (reviewed 2026-11-02; one confirmation is open, see "Open Decisions")
*   **Date:** 2026-11-02

--------------------------------------------------------------------------------

## Overview

The Expo mobile app (`apps/mobile`) has a Profile tab and a Chat tab. They load
their data through five HTTP calls: `GET /api/profile`, `PUT /api/profile`,
`GET /api/chat/threads`, `GET /api/chat/threads/:id/messages` and
`POST /api/chat/threads/:id/messages`. None of them exists in this repository's
`api/` folder, so against the production backend both tabs fail with 404.

This design adds those five endpoints plus one new endpoint,
`POST /api/chat/threads/:id/read` (six endpoints in four handler files). It
reuses the `fotbal` schema and the row-level security (RLS) rules the web app
already relies on. **Option A** in this document means the chosen approach: new
Vercel `/api` routes (see "Alternatives Considered").

## The Problem

The mobile app was built against an API that was never written. Its service
files (`apps/mobile/src/features/profile/profile-service.ts`,
`apps/mobile/src/features/chat/chat-service.ts`) and types
(`apps/mobile/src/types/profile.ts`, `apps/mobile/src/types/chat.ts`) describe
data that differs from what the database stores:

| Mobile expects | Database has today |
|---|---|
| `Profile.email` | No email column in `fotbal.profiles`; email is in Supabase Auth |
| `Profile.avatarUrl` | `avatar_path` (a storage path, not a URL), which nothing in the web app or `api/` ever writes |
| `Profile.role`: `parent`, `trainer`, `admin`, `player` | `user_role`: `owner`, `super_admin`, `trainer`, `parent` |
| `ChatThread.title`, `updatedAt` | `chat_threads.title` (nullable), `last_message_at` (nullable) |
| `ChatThread.unreadCount` | Nothing records which messages a user has read |
| `ChatMessage.content`, `authorId` | `chat_messages.body`, `sender_id` |

So the work is not only "add five routes". Each mismatch needs a decision: map
it in a server layer, change the mobile types, or add data to the schema.

There is also a choice about whether a server layer is needed at all. The web
app's chat (`client/src/components/ChatThread.tsx`) reads and writes
`chat_threads` and `chat_messages` directly through the Supabase client, and RLS
decides what each user can see. The mobile app already has a signed-in Supabase
client (`apps/mobile/src/lib/supabase.ts`), used only for sign-in and sessions:
no code in `apps/mobile` calls `supabase.from(...)` or `.rpc(...)` today. New
`/api` routes would sit in front of rules the database already enforces, and
every rule they add on top is a second copy that can drift from the first.

Who is affected today: anyone who opens the mobile app's Profile or Chat tab.
Whether the app has been published to a store is not recorded in the repository;
`docs/MOBILE_ARCHITECTURE.md` lists these routes as not yet implemented. This
design assumes nobody depends on the current broken behavior. **That assumption
is unconfirmed** (see "Open Decisions", item 1).

## Goals

Each goal names how it will be checked.

*   **G1.** The Profile tab shows the signed-in user's name, email and role from
    the production backend, with no 404 and no placeholder values. *Checked by:*
    the profile handler tests and the preview smoke test (see "Verification
    Plan").
*   **G2.** A profile update can change only `fullName`. A request that tries to
    change `id`, `role` or `email` is rejected with 400, not silently ignored.
    *Checked by:* `tests/api/mobile-api.test.ts` and
    `tests/api/mobile-profile.test.ts`.
*   **G3.** The Chat tab lists the threads the same signed-in user sees in the
    web app, most recent message first, threads without messages last. For an
    `owner` or `super_admin` that is every thread, capped at 100. *Checked by:*
    `supabase/tests/chat_access.test.sql` and the thread-list handler tests.
*   **G4.** A user can read a thread's messages and post to it only if the web
    app would let them; anyone else gets a 404 and sees no data. *Checked by:*
    `supabase/tests/chat_access.test.sql` and the message handler tests.
*   **G5.** Access rules live in the database. The new routes query only through
    `userClient(jwt)` and never through `serviceClient()`. *Checked by:* every
    handler test installs a `serviceClient` spy that fails the test if called.
*   **G6.** Every field in the mobile types is backed by real data or removed.
    `avatarUrl` is removed from `Profile`. *Checked by:* `pnpm check:mobile`.
*   **G7.** `Profile.role` matches the database `user_role` values, so an `owner`
    or `super_admin` account type-checks and is a supported mobile audience, with
    the same access as on the web (see "Decisions Made"). *Checked by:*
    `pnpm check:mobile` and `supabase/tests/chat_access.test.sql`.

## Non-Goals

*   Live updates in the mobile chat (the web app uses Supabase Realtime). This
    design covers load-on-open and pull-to-refresh only.
*   Creating new threads from the mobile app. The mobile client has no call for
    it today.
*   Attachments, message editing and message deletion.
*   Push notifications for new chat messages.
*   A profile editing screen. The "Editează profilul" button has no handler
    today; this design only provides the data path it will use.
*   Avatar upload and avatar display.
*   Pagination of the thread list and of older messages. The mobile client has no
    call for either.
*   Any change to the web app's chat or profile behavior.
*   Changing who may post in the academy-wide `parents` thread, which is open to
    every signed-in user by design (see "Decisions Made").
*   CORS support for the Expo Web build. It affects every `/api` route, so it is a
    separate change (see "Decisions Made").

## Decisions Made

Decided by the repository owner in the drafting session on 2026-11-02. No reasons
were recorded beyond the choice itself.

*   **Option A (server layer):** new Vercel `/api` routes. The mobile service
    code keeps its shape.
*   **Read tracking:** a new `fotbal.chat_reads` table and a sixth route that
    marks a thread as read.
*   **Scope of the first change (confirmed 2026-11-02):** all six endpoints and
    unread tracking in one change, with migration `0042`. The owner chose this
    over four endpoints with no migration (with `unreadCount` and its badge
    removed, or with `unreadCount` always `null`) after the trade-offs were
    listed, and gave no reasons. A known consequence: until a thread screen calls
    `markRead`, the unread badge in the chat list only grows (see "Risks and
    Mitigations").
*   **Roles:** the mobile `Profile.role` type becomes the database roles
    (`owner`, `super_admin`, `trainer`, `parent`); the API returns
    `profiles.role` unchanged.
*   **Owner and super_admin on mobile (confirmed 2026-11-02):** a supported
    audience with the same access as on the web. `fotbal.is_owner()` is true for
    both roles, so they see every thread (newest first, capped at 100, no
    pagination) and every message, and can post in any thread. The owner chose
    this over leaving the roles unsupported and over blocking them from chat on
    mobile, and gave no reasons.
*   **Rule 11 and Expo Web (confirmed 2026-11-02):** this ships as one PR, with a
    recorded exception to rule 11 in
    [`docs/CLAUDE_MOBILE_RULES.md`](../CLAUDE_MOBILE_RULES.md). The exception is
    limited to new files under `api/` and `supabase/` (the routes, the migration
    and the tests) and one change to the existing helper `api/_lib/supabase.ts`
    (`getAuthUser` is added and `getUserIdFromJwt` delegates to it; about ten
    existing handlers import that helper). Expo Web is knowingly unsupported for
    the Profile and Chat tabs until CORS is added in a separate change, outside
    this design; the rules file records that too. The owner chose this over two
    PRs (backend, then mobile) and over two PRs plus a CORS change, and gave no
    reasons.
*   **Posting in the `parents` thread (confirmed 2026-11-02):** open to every
    signed-in user, by design. The existing `chat_messages send if member` policy
    already allows it, so there is no migration and no policy change. Known
    consequences: one user can write to every parent and trainer, messages cannot
    be deleted through the app or the API (no delete policy), and the rate limit
    is best-effort, so cleanup needs a manual database delete (see "Risks and
    Mitigations"). The owner chose this over staff-only posting (a follow-up
    migration) and over deciding later, and gave no reasons.

Applied because of the review, not an owner choice: `avatarUrl` is removed from
the mobile `Profile` type, because the design's own goal G6 forbids a field that
is always null. The Profile screen already falls back to initials.

## Resolved Since Drafting

*   **Anonymous read of the `parents` thread.** Checked on the live database on
    2026-11-02. `anon` had `SELECT` on `fotbal.chat_threads` and
    `fotbal.chat_messages` (from the `0001` default privileges), and the read
    policies include `kind = 'parents'` with no sign-in check, so anyone holding
    the public anon key could have read every `parents` thread. There were 0
    threads and 0 messages, and no code creates a `parents` thread, so nothing was
    exposed. Fixed by
    [`0041_revoke_anon_chat_access.sql`](../../supabase/migrations/0041_revoke_anon_chat_access.sql)
    (PR #155), applied to production and recorded on 2026-11-02; the Security
    Advisor then reported no errors. The new routes were never affected, because
    they reject requests without a valid token.
*   **Migration number.** `0041` is taken, so this design's migration is
    `0042_chat_reads.sql`.

## Open Decisions

This needs the repository owner. It is a confirmation, not a decision, and it
does not block the plan. (Scope, unread tracking, owner access, rule 11 with Expo
Web, and posting in the `parents` thread were decided on 2026-11-02; see
"Decisions Made".)

1.  **Release status (confirmation).** Confirm the mobile app has not been
    published, which the problem statement assumes. *Blocking: no.*

Deferred, not blocking: **avatar storage.** Nothing writes `profiles.avatar_path`
and there is no bucket convention, so the mobile type has no avatar until one
exists.

## Critical User Journeys (CUJs)

### CUJ 1: Parent views their profile

*   **Given**: a parent is signed in to the mobile app with a valid Supabase
    session.
*   **When**: they open the Profile tab.
*   **Then**: their full name, email and role appear; no request returns 404.

### CUJ 2: User tries to change a protected field

*   **Given**: a signed-in parent.
*   **When**: the app sends a profile update that includes `role` or `email`.
*   **Then**: the update is rejected with 400 `forbidden_fields`, and the stored
    profile is unchanged.

### CUJ 3: Parent opens their chat list

*   **Given**: a parent with one child assigned to a trainer, a
    `parent_trainer` thread with that trainer, and the academy-wide `parents`
    thread.
*   **When**: they open the Chat tab.
*   **Then**: they see both threads and no thread belonging to another family,
    most recent message first and threads without messages last.

### CUJ 4: Parent reads and replies in a thread

*   **Given**: the parent from CUJ 3. The mobile app has no thread screen yet, so
    this journey runs at the API level (handler tests and the preview smoke test)
    until that screen exists.
*   **When**: they open their `parent_trainer` thread and send "Mulțumesc".
*   **Then**: the earlier messages load oldest to newest, the new message is
    saved with the parent as sender, and the trainer sees it in the web app.

### CUJ 5: User opens a thread they may not see

*   **Given**: a signed-in parent and the id of another family's thread.
*   **When**: the app requests that thread's messages or posts to it.
*   **Then**: the request fails with 404 and returns no messages; nothing is
    written.

### CUJ 6: Trainer views their threads

*   **Given**: a signed-in trainer with a group thread, several `parent_trainer`
    threads, and access to the academy-wide `parents` thread.
*   **When**: they open the Chat tab.
*   **Then**: they see their own group and parent threads and the `parents`
    thread, and no other trainer's threads.

### CUJ 7: Signed-out request

*   **Given**: no session, or an expired access token.
*   **When**: any profile or chat request is made.
*   **Then**: it fails with 401 and returns no data.

### CUJ 8: Owner or super_admin views all threads

*   **Given**: a signed-in `owner` or `super_admin`.
*   **When**: they open the Chat tab.
*   **Then**: they see the newest 100 threads across all families, including the
    academy-wide `parents` thread, and can open any of them and post. There is no
    pagination and no sign that older threads are missing.

### CUJ 9: Parent posts in the academy-wide thread

*   **Given**: a signed-in parent and an existing `parents` thread. Like CUJ 4,
    this runs at the API level until the mobile thread screen exists.
*   **When**: they post a message in that thread.
*   **Then**: the message is saved with the parent as sender, and every signed-in
    user can read it. Open posting is intended (see "Decisions Made").

## Technical Plan (Architecture)

### Shape of the solution

Six endpoints in four Vercel serverless files under `api/`, one migration, and
small mobile changes. Every database query in the new routes runs through
`userClient(jwt)`, the Supabase client that sends the caller's own access token,
so row-level security decides what each request can read or write, as it does for
the web app. The routes never use `serviceClient()`, which would skip RLS.

```text
Expo app (apps/mobile)
  src/lib/api.ts  ── Authorization: Bearer <Supabase access token> ──┐
                                                                     ▼
Vercel functions (api/)
  profile.ts                     GET, PUT    /api/profile
  chat/threads/index.ts          GET         /api/chat/threads
  chat/threads/[id]/messages.ts  GET, POST   /api/chat/threads/:id/messages
  chat/threads/[id]/read.ts      POST        /api/chat/threads/:id/read
       │  1. method check, bearer token → 405 / 401
       │  2. getAuthUser(jwt) → 401 if invalid or expired
       │  3. userClient(jwt): every query runs as the caller, under RLS
       │  4. map rows to the mobile JSON shapes
       ▼
Supabase (fotbal schema)
  profiles             RLS: read self or owner, update self
  chat_threads         RLS: existing "chat_threads visible" policy
  chat_messages        RLS: existing read and "send if member" policies
  chat_reads (new)     RLS: each user reads and writes only their own rows
  chat_unread_counts() and chat_mark_read() (new, security invoker)
Supabase Auth          /auth/v1/user → user id and email
```

### Existing policies this design relies on

From `supabase/migrations/0001_init.sql`, `0002_whatsapp_ai_chat.sql`,
`0003_groups_and_assignments.sql` and `0021_notify_security_fixes.sql`.
`fotbal.is_owner()` is true for `owner` and `super_admin` (since `0003`).

*Thread kinds (`fotbal.chat_thread_kind`):* `parent_trainer` is a 1:1 thread
between a parent and the child's assigned trainer, `group` is every parent of a
trainer's group, `parents` is the academy-wide thread (owner-led, per the `0002`
comment).

| Policy | Operation | Rule |
|---|---|---|
| `chat_threads visible` | select | owner; or the thread's trainer; or a `parent_trainer` thread for the caller's own child; or a `group` thread of a trainer who coaches the caller's child; or any `parents` thread. Signed-in users only since `0041`. |
| `chat_threads owner+trainer write` | insert | owner, or any trainer, or a `parent_trainer` thread for the caller's own child |
| `chat_threads bump update` | update | same conditions as `chat_threads visible` |
| `chat_messages read via thread` | select | the message's thread is visible under the rule above |
| `chat_messages send if member` | insert | `sender_id` is the caller and the thread is visible under the rule above |
| `chat_messages edit own` | update | `sender_id` is the caller |
| `profiles read self or owner` | select | the caller's own row, or any row for an owner |
| `profiles update self` | update | the caller's own row |
| `profiles owner update any` | update | any row, for an owner |

Posting in a `parents` thread is open to every signed-in user by design (see
"Decisions Made").

The trigger `profiles_lock_role` does not block a role change: it silently keeps
the old role unless the caller is an owner or the service role. The `PUT` route
rejects `role` before it reaches the database, so the trigger is a second guard.
The trigger `chat_msg_bump_thread` (`0002`) updates a thread's `last_message_at`
after every insert into `chat_messages`.

### Shared request handling

All six handlers follow the same steps, in this order:

1.  Reject an unsupported HTTP method with 405.
2.  Read the bearer token with the existing `getJwtFromHeader`. If it is missing,
    return 401.
3.  Resolve the caller with `getAuthUser(jwt)` in `api/_lib/supabase.ts`, which
    calls Supabase Auth `/auth/v1/user` and returns the id and email. If the token
    is invalid or expired, return 401.
4.  Validate the path parameter and the body (a thread id must be a UUID).
5.  Query through `userClient(jwt)` only.

**Responses.** Existing handlers return `{ "error": "<code>" }` with snake_case
codes (`method_not_allowed`, `missing_bearer`, `invalid_jwt`). The new routes keep
those codes and add a Romanian `message`, because the mobile `ApiError` shows
`message` and otherwise falls back to "Request failed with status N". Server
errors are logged with the route name; database error text is never sent to the
client.

| Condition | Status | `error` | `message` | Header |
|---|---|---|---|---|
| Unsupported method | 405 | `method_not_allowed` | "Metodă nepermisă." | |
| No bearer token | 401 | `missing_bearer` | "Nu ești autentificat." | |
| Invalid or expired token, or Auth returns no email | 401 | `invalid_jwt` | "Nu ești autentificat." | |
| Thread id is not a UUID | 400 | `invalid_thread_id` | "Identificator invalid." | |
| Body is not an object, or a value is invalid | 400 | `invalid_body` | "Date invalide." | |
| Profile update has keys other than `fullName` | 400 | `forbidden_fields` | "Câmpuri nepermise: <keys joined with ', '>." | |
| Thread hidden or unknown, no profile row, update matched no row, or Postgres `42501` | 404 | `not_found` | "Nu a fost găsit." | |
| Over the message rate limit | 429 | `rate_limited` | "Prea multe mesaje. Încearcă din nou în câteva secunde." | `Retry-After`: `ceil(resetIn / 1000)` seconds |
| Anything else, including Postgres `23503` and a failed unread-count call | 500 | `server_error` | "Eroare de server." | |

`Retry-After` follows `api/lead/reply-draft.ts`, which sets it with
`res.setHeader?.(...)`. The app signs in with email only, so a token whose Auth
user has no email is treated as invalid.

### Profile: `GET /api/profile`

Reads the caller's row with
`.from("profiles").select("id, full_name, role, created_at").eq("id", user.id).maybeSingle()`.
The explicit `id` filter is required: `profiles read self or owner` lets an owner
read every row, so without it an owner would get several rows. No row returns
404. The response:

| Field | Source |
|---|---|
| `id` | `profiles.id` |
| `fullName` | `profiles.full_name` |
| `email` | Supabase Auth user, from `getAuthUser` |
| `role` | `profiles.role`, unchanged |
| `createdAt` | `profiles.created_at` |

### Profile: `PUT /api/profile`

The only field a user may change is `fullName`; `phone` and `locale` can be added
later without changing this design.

*   **Parsing (zod, as in `api/messages/send.ts`).** A body that is not a plain
    object (null, array, string) returns 400 `invalid_body`. Any key other than
    `fullName` returns 400 `forbidden_fields` with the rejected keys in the
    message, even when `fullName` is valid, so `id`, `role`, `email` and
    `createdAt` are never applied. `fullName` is trimmed first, then must be 2 to
    120 characters, else 400 `invalid_body`.
*   **Update.**
    `.from("profiles").update({ full_name }).eq("id", user.id).select("id, full_name, role, created_at").maybeSingle()`.
    The "profiles update self" policy applies. Under RLS an update that matches no
    row returns no error, so an empty result returns 404 `not_found`.
*   Returns the updated profile in the same shape as `GET`.

### Chat: `GET /api/chat/threads`

1.  Select the threads the caller may see, with
    `.from("chat_threads").select("id, kind, title, last_message_at, created_at")`
    ordered by `last_message_at` descending with nulls last
    (`nullsFirst: false`), then `created_at` descending, then `id` descending, and
    `.limit(100)`. The 100-row cap matches the web chat's message limit and there
    is no pagination: a user with more than 100 threads (an owner, or a trainer
    with many families) loses the oldest, with no sign that threads are missing. An
    `owner` or `super_admin` sees every thread, so they reach the cap first. The
    Supabase client cannot order by
    `coalesce(last_message_at, created_at)`, so threads with no messages sort
    last.
2.  Call `fotbal.chat_unread_counts()` once. It returns a row for every visible
    thread; a thread created between the two calls is treated as 0. If the call
    fails the whole request returns 500, because a made-up count would break
    goal G6.
3.  Map each row:
    *   `title`: `chat_threads.title` if set, otherwise a fixed Romanian label by
        kind: `parent_trainer` → "Antrenor", `group` → "Grupa",
        `parents` → "Părinți". Trainer and child names are not looked up, because
        a parent cannot read other people's profiles under RLS. **Known gap:** a
        trainer with several `parent_trainer` threads sees identical titles.
    *   `updatedAt`: `last_message_at`, or `created_at` if there are no messages.
    *   `unreadCount`: from step 2.

### Chat: `GET /api/chat/threads/:id/messages`

1.  Check the thread with `.from("chat_threads").select("id").eq("id", id).maybeSingle()`.
    If RLS hides it or it does not exist, return 404 `not_found`; both look the
    same, so the response does not reveal whether a thread exists.
2.  Load `.from("chat_messages").select("id, thread_id, sender_id, body, created_at")`
    filtered by `thread_id`, ordered by `created_at` descending then `id`
    descending, `.limit(100)`, and return the rows oldest first. This returns the
    newest 100 messages; the web chat loads the oldest 100 (`created_at`
    ascending, limit 100), which this route deliberately does not copy.
3.  Map `thread_id` → `threadId`, `sender_id` → `authorId`, `body` → `content`,
    `created_at` → `createdAt`.

### Chat: `POST /api/chat/threads/:id/messages`

1.  `content` is trimmed and must be 1 to 4000 characters, the same limit as the
    `chat_messages.body` check constraint; otherwise 400 `invalid_body`.
2.  Best-effort rate limit: `checkRateLimit("chat-send:" + user.id, 30, 60000)`.
    The helper (`api/_lib/ratelimit.ts`) keeps a fixed-window counter in a Map in
    one function instance's memory, so the effective limit across instances is
    higher. Over the limit returns 429 with `Retry-After`.
3.  Insert with
    `.from("chat_messages").insert({ thread_id, sender_id: user.id, body }).select("id, thread_id, sender_id, body, created_at").single()`.
    The "chat_messages send if member" policy accepts the row only if the caller
    can see the thread and `sender_id` is the caller. A thread the caller cannot
    see, and a thread id that does not exist, both fail the RLS check (`42501`)
    before the foreign key is checked, so both return 404; the pgTAP test
    verifies this. Any other error, including `23503`, returns 500.
4.  The trigger `chat_msg_bump_thread` updates `last_message_at`; the route does
    not.
5.  Return 201 with the new message in the mobile shape.

### Chat: `POST /api/chat/threads/:id/read`

Calls `userClient(jwt).rpc("chat_mark_read", { p_thread: id })`, which upserts
`fotbal.chat_reads (user_id, thread_id, last_read_at = now())` using the database
clock (a server clock a few seconds off would miscount messages sent around the
read). A thread the caller cannot see fails the table's RLS check (`42501`) and
returns 404. Returns 204 with no body; the route does not read the request body,
although the mobile client sends a JSON content type. The thread screen calls it
each time it loads a thread's messages.

### Migration: read tracking

A new migration, `0042_chat_reads.sql`. Schema skeleton, to be reviewed before it
is committed:

```sql
create table fotbal.chat_reads (
  user_id uuid not null references fotbal.profiles(id) on delete cascade,
  thread_id uuid not null references fotbal.chat_threads(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
alter table fotbal.chat_reads enable row level security;

create policy "chat_reads select own" on fotbal.chat_reads
  for select using (user_id = auth.uid());
create policy "chat_reads insert own" on fotbal.chat_reads
  for insert with check (
    user_id = auth.uid()
    and thread_id in (select id from fotbal.chat_threads));
create policy "chat_reads update own" on fotbal.chat_reads
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and thread_id in (select id from fotbal.chat_threads));
-- No delete policy: with RLS on, deletes are denied even though the default
-- privileges grant DELETE.

revoke all on fotbal.chat_reads from anon;
grant select, insert, update on fotbal.chat_reads to authenticated, service_role;

create function fotbal.chat_unread_counts()
returns table (thread_id uuid, unread int)
language sql stable security invoker set search_path = fotbal, public as $$
  select t.id, count(m.id)::int
    from fotbal.chat_threads t
    left join fotbal.chat_reads r
           on r.thread_id = t.id and r.user_id = auth.uid()
    left join fotbal.chat_messages m
           on m.thread_id = t.id
          and m.sender_id <> auth.uid()
          and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
   group by t.id
$$;

create function fotbal.chat_mark_read(p_thread uuid)
returns void
language sql volatile security invoker set search_path = fotbal, public as $$
  insert into fotbal.chat_reads (user_id, thread_id, last_read_at)
  values (auth.uid(), p_thread, now())
  on conflict (user_id, thread_id) do update set last_read_at = now()
$$;

revoke execute on function fotbal.chat_unread_counts() from public, anon;
revoke execute on function fotbal.chat_mark_read(uuid) from public, anon;
grant execute on function fotbal.chat_unread_counts() to authenticated, service_role;
grant execute on function fotbal.chat_mark_read(uuid) to authenticated, service_role;
```

Notes on behavior:

*   Both functions are `security invoker`, so RLS on the three tables applies to
    the caller. Starting from `chat_threads` means every visible thread gets a
    row, including threads with no messages.
*   A message created at exactly `last_read_at` counts as read (the comparison is
    strict `>`). `now()` is the transaction start time, so a message from a
    transaction that started before the read but committed after it can be counted
    as read. This is accepted: the effect is one missed unread.
*   Only mobile writes `chat_reads`. A message read on the web stays unread on
    mobile until the web app calls `chat_mark_read`. Web support is out of scope.
*   Performance: the existing index `chat_messages_thread_idx` on
    `(thread_id, created_at)` (from `0002`) serves the join. No data volumes or
    query plan have been measured; measure the thread-list call on the preview
    before release, and see the risk table.
*   Like every migration in this project, it is applied to production by hand
    before the API change deploys (see "Rollout order and rollback").

### Mobile changes

*   `apps/mobile/src/types/profile.ts`: `role` becomes
    `"owner" | "super_admin" | "trainer" | "parent"`, and `avatarUrl` is removed.
    `Profile` is then `id`, `fullName`, `email`, `role`, `createdAt`.
*   `apps/mobile/app/tabs/profile.tsx`: the only code that reads `avatarUrl` is
    the `Avatar` line; it passes `null` for `uri` instead.
*   `apps/mobile/src/features/profile/profile-service.ts`: `update` accepts
    `{ fullName: string }` only.
*   `apps/mobile/src/features/chat/chat-service.ts`: add `markRead(threadId)`. No
    screen calls it yet, because the thread screen does not exist.

### Security notes

*   No new route uses the service role (goal G5), so a route cannot return more
    than the web app shows the same user.
*   Unknown and hidden threads return the same 404, so thread ids cannot be
    probed.
*   The routes need no new secrets or environment variables. They use the
    `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `VITE_` versions) that
    `userClient` already reads.
*   An `owner` or `super_admin` session can read and post in every thread, as on
    the web, so a lost phone or session exposes every family's messages. No
    mobile-specific control is added in this change.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `0042` is not applied before the API deploys | `GET /api/chat/threads` returns 500, so the whole Chat tab fails | Apply `0042` first; the rollout order puts it before the merge; the preview smoke test runs against the migrated database |
| No rollback for `0042` | A bad migration stays in production | The migration is additive. Revert the PR; leave the table and functions (`anon` has no access) or remove them in a new migration `0043`. Never edit `0042` |
| `chat_unread_counts()` is slow at scale | Slow Chat tab; RLS runs per message row | The `(thread_id, created_at)` index exists; measure on the preview; if too slow, return `unreadCount` null on timeout in a later change (this design returns 500 instead of a made-up count) |
| The 100-thread and 100-message caps truncate lists | An owner or a busy trainer misses old threads | Documented; no pagination yet (Non-Goals) |
| Supabase Auth outage | Every route returns 401 or 500 | Same dependency as the web app's sign-in; no extra mitigation |
| An older mobile build against a changed API | A build that predates a later change shows errors | The API is not versioned; keep response fields additive and release the mobile build after the API |
| `[id]` route files do not resolve on Vercel | The chat message and read routes return a platform 404 | The preview must prove they resolve; fallback in "Conventions for the new API files" |
| Per-instance rate limit | A determined user can exceed 30 messages a minute | Accepted; best-effort only |
| The unread badge never clears until a thread screen exists | After release, the chat list shows a count that only grows, because nothing calls `markRead` yet and reading on the web never clears it | A known consequence of shipping unread tracking in this change. The thread screen is the follow-up that fixes it; keep it next in line after this change |
| An owner or super_admin phone or session is lost | Every family's messages are readable, and any thread writable, with that session | Accepted: the same exposure as on the web, and no mobile-specific control in this change |
| Expo Web cannot call these routes (no CORS headers on any `/api` route) | The Profile and Chat tabs fail in a Web build of the mobile app | Recorded as unsupported in the rules file; CORS is a separate change |
| The rule 11 exception is not recorded where contributors look | The next mobile change edits `api/` again without review | The exception is written into `docs/CLAUDE_MOBILE_RULES.md` as part of this change |
| Any signed-in user can post in the academy-wide `parents` thread | One user can write to every parent and trainer, and messages cannot be deleted through the app or the API | Accepted as intended. The rate limit is best-effort; cleanup needs a manual database delete; revisit if abuse appears |

## Alternatives Considered

The repository owner chose Option A (new Vercel `/api` routes) on 2026-11-02 and
did not give reasons. No predecessor brief existed, so the alternatives and the
trade-offs below come from the drafting session and from the repository. The
"Reason for Rejection" lines are checkable trade-offs, not the owner's words.

### Alternative B: Mobile reads and writes through Supabase directly

The mobile services would call `supabase.from("chat_threads")` and similar
queries under RLS, the way the web app's chat does, and map field names inside
`chat-service.ts` and `profile-service.ts`.

*   **Pros**: least new code; no new serverless functions; the same query path as
    the web chat; live updates through Supabase Realtime become possible later.
*   **Cons**: breaks mobile rule 3 in
    [`docs/CLAUDE_MOBILE_RULES.md`](../CLAUDE_MOBILE_RULES.md) ("no direct
    `supabase` calls outside `src/lib/supabase.ts` and `src/features/auth/`"), so
    the rules document would change. A profile update could be limited to allowed
    fields only in the database (a trigger or column grants), and a rate limit
    would have to live in the database too.
*   **Reason for Rejection**: it changes a project rule and moves the profile
    allow-list and rate limiting into the database. A schema change would not break
    installed mobile builds, because no mobile code queries tables today; this was
    first given as a reason and is wrong. B remains valid if fewer moving parts
    matter more; the owner chose Option A.

### Alternative C: Database functions (RPCs) that return the mobile shapes

`security invoker` SQL functions (for example `fotbal.mobile_chat_threads()` and
`fotbal.mobile_send_message(id, content)`) would return the mobile JSON shapes.
The mobile app would call them through a thin wrapper in `src/lib`.

*   **Pros**: the response shape is defined once, in a migration, and can be
    tested with pgTAP like `supabase/tests/grants.test.sql`; no serverless
    functions to add.
*   **Cons**: the logic lives in SQL, which is harder to change than TypeScript;
    a function created `security definer` by mistake would skip RLS; the mobile
    app needs a second call style.
*   **Reason for Rejection**: each change to a response shape needs a manual
    production migration. Option A also needs one for `chat_reads`, so the gap is
    smaller than first stated; the remaining difference is SQL versus TypeScript
    and one more call style in the mobile app.

### Alternative D: Hybrid, direct Supabase for reads and sends, API only for the profile update

*   **Pros**: one `/api` route instead of six; the profile allow-list stays on a
    server.
*   **Cons**: two access styles in one app, and rule 3 is still broken for chat.
*   **Reason for Rejection**: mixes both costs of A and B.

### Alternative E: Supabase Edge Functions instead of Vercel functions

*   **Pros**: runs next to the database.
*   **Cons**: the repository has no edge functions (`supabase/config.toml` declares
    none) and a separate deploy path from Vercel.
*   **Reason for Rejection**: a new runtime and deploy path for six routes.

### Alternative F: Track unread counts on the device

*   **Pros**: no migration and no sixth route.
*   **Cons**: counts are not shared across devices and are lost on reinstall;
    the web app would still disagree.
*   **Reason for Rejection**: gives a count that differs by device. Dropping
    `unreadCount` entirely is the other no-migration option; the owner chose to keep
    server-side read tracking in this change (see "Decisions Made").

### Rejected variant of Option A: routes that use the service role

The new routes could use `serviceClient()` and check access in TypeScript, which
would allow, for example, thread titles built from trainer and child names.

*   **Pros**: can return data a parent cannot read under RLS, such as other
    people's names.
*   **Cons**: it skips RLS and re-implements the chat visibility rules, a second
    copy that can drift from the database policies. A bug in that copy exposes
    another family's messages.
*   **Reason for Rejection**: excluded by goal G5. This option was not put to the
    owner as a choice.

### Smaller choices

*   **Map `owner` and `super_admin` to `admin` for the mobile app.**
    *   **Pros**: the mobile type stays close to its old shape.
    *   **Cons**: `player` is removed anyway, and the API would hide the
        difference between the two roles.
    *   **Reason for Rejection**: not selected by the owner; the plan returns the
        database roles unchanged.
*   **Treat `owner` and `super_admin` as an unsupported mobile audience.**
    *   **Pros**: the least work and no new rule in the code.
    *   **Cons**: owners could still sign in and would get all threads, because
        the database allows it, with no tests and no stated behavior.
    *   **Reason for Rejection**: the access exists either way, so it is better
        stated and tested. Not selected by the owner.
*   **Block `owner` and `super_admin` from the chat routes (403 `forbidden`).**
    *   **Pros**: no family's messages on an owner's phone.
    *   **Cons**: a role lookup on every chat request and a second rule on top of
        RLS, against goal G5; one chat route missing the check would still leak
        threads.
    *   **Reason for Rejection**: adds a second copy of an access rule that the
        database already holds. Not selected by the owner.
*   **Two PRs: backend first, then mobile.**
    *   **Pros**: keeps rules 11 and 12 as written (the mobile PR touches no `api/`
        file), matches the rollout order, and each half rolls back separately.
    *   **Cons**: two reviews and merges in order, a smoke test that needs a mobile
        build pointed at the backend preview, and a stretch where the API exists
        but nothing calls it.
    *   **Reason for Rejection**: more coordination for the same change. Not
        selected by the owner.
*   **Two PRs, plus a separate CORS change so Expo Web works.**
    *   **Pros**: Web works for these tabs and the Definition of Done holds.
    *   **Cons**: the CORS change edits every existing `/api` route or a shared
        wrapper, needs an allowed-origins decision (including where Expo Web would
        be hosted, which is not recorded in the repository), and can regress the
        web app's own calls.
    *   **Reason for Rejection**: a larger blast radius on production handlers for
        a build that is not known to be deployed. Not selected by the owner.
*   **Limit posting in `parents` threads to staff (owners and super_admins).**
    *   **Pros**: matches the `0002` comment "owner-led", and a parent cannot flood
        the thread.
    *   **Cons**: needs a follow-up migration that tightens the insert policy and a
        test; changes the policy for the web app too; a parent who posts through
        the new route would get 404 `not_found`, because the database cannot say
        why it refused, which is misleading for a thread they can see.
    *   **Reason for Rejection**: more work and a confusing error for a thread no
        one has created yet. Not selected by the owner.
*   **Leave the posting rule undecided until the first `parents` thread exists.**
    *   **Pros**: no work now.
    *   **Cons**: posting stays open by default, so a thread created before the
        decision is open to everyone anyway.
    *   **Reason for Rejection**: it postpones a decision that has a default.
        Not selected by the owner.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

This section lists each file to create or modify. Repeated detail lives in the
Technical Plan; here only what the Technical Plan does not say.

### Conventions for the new API files

*   **Style.** Match `api/messages/send.ts`: a header comment describing the
    route, local `Req` and `Res` types (with optional `setHeader`, as in
    `api/lead/reply-draft.ts`), `zod` for body validation, and imports ending in
    `.js` (for example `../_lib/supabase.js`). Prettier settings from the repo:
    double quotes, semicolons, `printWidth: 80`, `trailingComma: es5`,
    `arrowParens: avoid`. Mobile files keep the style of the file being edited.
*   **Dynamic routes.** `api/chat/threads/[id]/messages.ts` receives the thread
    id in `req.query.id` through Vercel's file-system routing. The repo has no
    `[id]` files yet. They are used so the mobile URLs and `vercel.json` stay
    unchanged. The rewrite `/api/(.*)` → `/api/$1` is an identity rewrite and
    should not interfere. **Fallback if the preview returns a platform 404:** one
    catch-all file, `api/chat/[...path].ts`, that dispatches on the path, or a
    rewrite in `vercel.json` (which then leaves the "must not change" list).
*   **No new environment variables.**

### Target Files to Create/Modify

#### Database

##### 1. `supabase/migrations/0042_chat_reads.sql` (Create)

*   **Type / Scope**: SQL migration (schema `fotbal`).
*   **Proposed Changes**: the schema skeleton in the Technical Plan, plus a header
    comment explaining the "why" and that it is applied to production by hand
    before the API deploys. `0041` must already be applied (it is).

##### 2. `supabase/tests/chat_reads.test.sql` (Create)

*   **Type / Scope**: pgTAP test, same layout as `supabase/tests/grants.test.sql`
    (begin; plan; fixture as `postgres`; `set local role` with
    `request.jwt.claims`; rollback). `plan(N)` is the number of assertions below.
*   **Proposed Changes**: fixture: an owner, parent A, parent B, one trainer with a
    trainer row, a child of parent A assigned to that trainer, a `parent_trainer`
    thread for A's child, a `parent_trainer` thread for B's child, and the
    `parents` thread. Messages use explicit `created_at` values (for example
    `now() - interval '3 hours'`), because `now()` is frozen inside a pgTAP
    transaction. Assertions: (a) `anon` has no privilege on `chat_reads` and cannot
    execute either function; (b) parent A sees only their own `chat_reads` rows;
    (c) `chat_mark_read` on a visible thread creates one row for the caller, and
    a second call leaves one row; (d) `chat_mark_read` on another family's thread
    and on a nonexistent thread id both raise `42501` and write nothing;
    (e) before any read, the count is every message sent by someone else;
    (f) with a `chat_reads` row inserted at an explicit time, only newer messages
    count; (g) a message created exactly at `last_read_at` does not count;
    (h) the caller's own messages do not count; (i) parent B's counts are
    unaffected by parent A's reads.

##### 3. `supabase/tests/chat_access.test.sql` (Create)

*   **Type / Scope**: pgTAP test of the existing chat policies as access rules (the
    handler tests only prove mapping).
*   **Proposed Changes**: with the same fixture style: parent A sees their own
    `parent_trainer` thread and the `parents` thread and cannot see parent B's
    thread or its messages; parent A cannot insert a message into parent B's
    thread; a trainer sees only their own threads; an owner and a super_admin each see all
    threads and can post in any of them; a parent can post in the `parents` thread
    (open posting is intended).

#### API

##### 4. `api/_lib/supabase.ts` (Modify)

*   **Type / Scope**: TypeScript module (shared server helpers).
*   **Proposed Changes**: add `getAuthUser(jwt): Promise<{ id: string; email:
    string | null }>`; it calls `${URL}/auth/v1/user` and throws
    `Error("Not authenticated")` on a non-OK response or missing id. `email` is
    `null` when Auth returns a missing or empty email. `getUserIdFromJwt` is
    changed to delegate to it, so the one network call lives in one place and
    its callers (which still receive the id string and the same error) are not
    affected.

##### 5. `api/_lib/mobile-api.ts` (Create)

*   **Type / Scope**: TypeScript module shared by the four handler files.
*   **Proposed Changes**: the shared request handling and the response table from
    the Technical Plan: an `authenticate` step that returns the token and user or
    sends the 401, one function that writes the error shape, thread-id parsing,
    the mapping from database rows to the mobile shapes, and the profile and
    message body parsers. It imports only `getJwtFromHeader` and `getAuthUser`
    from `./supabase.js` and never `serviceClient`.

##### 6. `api/profile.ts` (Create)

*   **Type / Scope**: Vercel function, `GET` and `PUT /api/profile`.
*   **Proposed Changes**: as in "Profile: GET" and "Profile: PUT".

##### 7. `api/chat/threads/index.ts` (Create)

*   **Type / Scope**: Vercel function, `GET /api/chat/threads`.
*   **Proposed Changes**: as in "Chat: GET /api/chat/threads"; joins the unread
    counts by `thread_id` in memory.

##### 8. `api/chat/threads/[id]/messages.ts` (Create)

*   **Type / Scope**: Vercel function, `GET` and `POST
    /api/chat/threads/:id/messages`.
*   **Proposed Changes**: as in the two message sections.

##### 9. `api/chat/threads/[id]/read.ts` (Create)

*   **Type / Scope**: Vercel function, `POST /api/chat/threads/:id/read`.
*   **Proposed Changes**: as in "Chat: POST .../read". Does not read `req.body`.

#### Tests (Vitest, `tests/api/`)

##### 10. `tests/api/mobile-api.test.ts` (Create)

*   **Type / Scope**: unit test for the pure helpers in `mobile-api.ts`.
*   **Proposed Changes**: the profile body parser (accepts only `fullName`; rejects
    `role`, `email`, `id` and `createdAt` even beside a valid name; non-object
    input; trim-then-length), the message body parser (trim, empty, 4000 limit),
    thread-id parsing (UUID, array, missing), and the mappers asserted with
    `toEqual` on the exact field sets (`Profile`: `id`, `fullName`, `email`,
    `role`, `createdAt`; `ChatThread`: `id`, `title`, `updatedAt`, `unreadCount`;
    `ChatMessage`: `id`, `threadId`, `authorId`, `content`, `createdAt`), including
    the title rule for each kind and the `updatedAt` fallback.

##### 11. `tests/api/get-auth-user.test.ts` (Create)

*   **Type / Scope**: unit test for `getAuthUser` with `fetch` mocked.
*   **Proposed Changes**: returns id and email; returns `email: null` for a missing
    or empty email; throws on a non-OK response and on a missing id.

##### 12. `tests/api/mobile-profile.test.ts` (Create)

*   **Type / Scope**: handler tests for `api/profile.ts`.
*   **Proposed Changes**: the cases in the coverage table (Verification Plan), plus
    a request with an owner's token returns only the owner's own row.

##### 13. `tests/api/mobile-chat.test.ts` (Create)

*   **Type / Scope**: handler tests for the three chat files.
*   **Proposed Changes**: the cases in the coverage table, plus: the list route
    asserts the three `order` calls and the `limit(100)`; `POST` ignores any
    `senderId` in the body and sets `sender_id` to the caller; the 429 test uses a
    unique user id per test, because `checkRateLimit` keeps its counters in a
    module-level Map that persists across tests.

**Shared test setup (files 12 and 13).** `vi.mock` of
`../../api/_lib/supabase` with `importOriginal`, keeping the real
`getJwtFromHeader` and replacing `getAuthUser`, `userClient` and `serviceClient`.
`userClient` returns a small fake query builder: `from(table)` returns a
chainable object with `select`, `eq`, `order`, `limit`, `insert`, `update`,
`maybeSingle` and `single`, which records every call in an array and resolves to
a `{ data, error }` preset by the test; `rpc(name, args)` does the same.
`serviceClient` is a spy that fails the test if called. The fake `Res` records
`status`, `json`, `setHeader` and `end`. These tests prove mapping and error
handling; access rules are proved by the pgTAP tests (files 2 and 3).

#### Mobile app

##### 14. `apps/mobile/src/types/profile.ts` (Modify)

*   **Type / Scope**: TypeScript type.
*   **Proposed Changes**: `role` union and `avatarUrl` removal, as in "Mobile
    changes".

##### 15. `apps/mobile/app/tabs/profile.tsx` (Modify)

*   **Type / Scope**: React Native screen (one line).
*   **Proposed Changes**: pass `null` to `Avatar`'s `uri` instead of
    `profile?.avatarUrl ?? null`; no other change.

##### 16. `apps/mobile/src/features/profile/profile-service.ts` (Modify)

*   **Type / Scope**: TypeScript module.
*   **Proposed Changes**: `update` accepts `{ fullName: string }`.

##### 17. `apps/mobile/src/features/chat/chat-service.ts` (Modify)

*   **Type / Scope**: TypeScript module.
*   **Proposed Changes**: add `markRead(threadId)` calling `api.post<void>` on
    `/api/chat/threads/${threadId}/read`. Do not change `src/lib/api.ts`: it
    already returns `undefined` for an empty body.

#### Contracts and docs

##### 18. Three new contract files (Create)

*   **Type / Scope**: Markdown contracts, same format as the other `EGM.md` files
    (Overview, Interface, Invariants, Side Effects, Verification; the first is a
    blueprint with Overview and a Subdirectories list).
*   **Proposed Changes**: `api/chat/EGM.md` (blueprint, links `./threads/EGM.md`);
    `api/chat/threads/EGM.md` (list route, link to `./[id]/EGM.md`);
    `api/chat/threads/[id]/EGM.md` (messages and read routes).

##### 19. Existing contracts and docs (Modify)

*   **Type / Scope**: Markdown.
*   **Proposed Changes**: update each file below, then re-run the drift report.

| File | Change |
|---|---|
| `api/EGM.md` | Interface: add `GET` and `PUT /api/profile`; list the `chat` subsystem. Authentication invariant: the profile and chat routes resolve the caller with `getAuthUser` and query only through `userClient`, so they are an exception to "each handler queries `profiles` itself" |
| `api/_lib/EGM.md` | `supabase.ts`: add `getAuthUser`, and note `getUserIdFromJwt` delegates to it; add a `mobile-api.ts` entry |
| `apps/mobile/src/types/EGM.md` | `Profile` fields and the new `role` union |
| `apps/mobile/src/features/chat/EGM.md` | Add `markRead`; replace the sentence "No server handler for `/api/chat/threads` or ... exists in this repo" with the real routes |
| `apps/mobile/src/features/profile/EGM.md` | Replace "No server handler for `GET /api/profile` or `PUT /api/profile` exists" and "whichever server implements this route must enforce field permissions" with: only `fullName` is accepted and any other key returns 400; `update` takes `{ fullName: string }` |
| `apps/mobile/src/features/EGM.md` | Remove the two "No server handler for these routes exists in this repo" sentences |
| `apps/mobile/EGM.md` | Remove "No handler for these routes exists in this repo (`api/` has no `profile` or `chat/` entry), so they would return 404 ..." |
| `apps/EGM.md` | Remove "No handler for these endpoints exists in this repo's `api/`." |
| `apps/mobile/app/tabs/EGM.md` | Profile: the avatar is `null` (no `avatarUrl`) |
| `docs/MOBILE_ARCHITECTURE.md` | Replace the bullet starting "`/api/profile`, `/api/chat/*` endpoints" under "What's not wired yet" with the six routes, and add that the thread screen (the only caller of `getMessages`, `sendMessage` and `markRead`) is not built |
| `supabase/migrations/EGM.md` | Range `0001` to `0042`; add `chat_reads`, the two functions, their grants and RLS |
| `supabase/EGM.md` | Add `chat_reads.test.sql` and `chat_access.test.sql` to the test list |
| `docs/CLAUDE_MOBILE_RULES.md` | Rule 11: add the exception recorded under "Decisions Made" (new files under `api/` and `supabase/`, and `api/_lib/supabase.ts`, for the profile and chat routes). Definition of done: say the Web build is unsupported for the Profile and Chat tabs until CORS is added |

#### Files that must not change

`vercel.json` (unless the `[id]` fallback needs a rewrite), `.env.example`,
`tests/mobile-release-gate.test.ts`, every mobile screen under `apps/mobile/app/`
except `app/tabs/profile.tsx`, and everything under `client/`. If the build shows
any other file needs a change, stop and revise this plan.

### Rollout order and rollback

Checkpoints: after each group, run its verify command.

1.  **Database.** Open the PR; do not merge. Apply `0042_chat_reads.sql` to the
    production Supabase project. `0041` is already applied. Run one transaction in
    the dashboard SQL editor: the migration statements, then an `insert` into
    `supabase_migrations.schema_migrations (version, name, statements)` with a
    UTC timestamp version, the file name and the statements array (as done for
    `0040` and `0041`). The repository owner applies it, or Claude Code in the
    owner's Chrome session with the owner's approval. *Verify:* `anon` has no
    privilege on `chat_reads` and cannot execute either function; the migration
    row exists; the Security Advisor shows no new errors.
2.  **API.** *Verify:* `pnpm check:api` and `pnpm test`; then the preview smoke
    test (Verification Plan) against the Vercel preview of the PR.
3.  **Merge** the PR; Vercel deploys. The migration must already be live:
    `GET /api/chat/threads` returns 500 if `chat_unread_counts()` does not exist.
4.  **Mobile.** *Verify:* `pnpm check:mobile`; release the mobile build that
    includes the new types and `markRead`.

Rollback: the routes and the migration are additive. Revert the PR; the new table
and functions can stay (`anon` has no access to them). If they must go, add a new
migration `0043`; do not edit `0042`. Rolling back the API after the mobile
release leaves `markRead` returning 404, which is harmless because no screen
calls it yet.

### Verification Plan

*   **Compilation/Build**: `pnpm build`.
*   **Unit Tests**: `pnpm test`, including the four new files in `tests/api/`.
*   **Static Analysis & Linting**: `pnpm check`, which runs `check:env`,
    `check:app`, `check:api` and `check:mobile`; `pnpm audit:production` (part of
    the Vercel build) and `pnpm audit:all` (run by the CI `verify` job);
    `npx prettier --check --end-of-line auto` on every new or changed file, fixing
    only violations on lines this change adds (the repo has older violations).
*   **Test Coverage Requirement**: the repo has no coverage threshold. Required
    instead, for every route: a handler test for each applicable case below.

| Route | 401 | 405 | Invalid input | Success shape | 404 | 500 |
|---|---|---|---|---|---|---|
| `GET /api/profile` | yes | yes | n/a | yes | no profile row | yes |
| `PUT /api/profile` | yes | yes | forbidden keys, non-object, bad name | yes | update matches no row | yes |
| `GET /api/chat/threads` | yes | yes | n/a | yes (merge and order) | n/a | unread call fails |
| `GET .../messages` | yes | yes | bad thread id | yes (oldest first) | thread hidden | yes |
| `POST .../messages` | yes | yes | bad id, empty, 4001 characters | yes (201) | `42501` | yes; also 429 |
| `POST .../read` | yes | yes | bad thread id | yes (204) | `42501` | yes |

*   **Database tests**: `supabase test db` runs `chat_reads.test.sql` and
    `chat_access.test.sql` in CI (`verify` job). It cannot run locally without
    Docker.
*   **E2E/Integration (preview smoke test)**: on the Vercel preview of the PR,
    with `EXPO_PUBLIC_API_BASE_URL` pointing at it and a signed-in test parent and
    test trainer: `GET /api/profile` returns the profile and email; `PUT` with
    `role` returns 400; the chat list shows only that user's threads; marking a
    thread read sets its unread count to 0; and requesting
    `/api/chat/threads/<random uuid>/messages` returns our handler's JSON
    `not_found`, not a platform HTML 404 (this proves the `[id]` route resolves).
*   **Contract check**: after editing contracts, re-run the EGM drift report on
    the changed `EGM.md` files. EGM contracts (the `EGM.md` files) describe each
    code directory's interface, invariants, side effects and verification
    command; the drift report is the `egm-drift-report` skill, which compares
    them with the code.

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
