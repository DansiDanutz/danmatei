# api/academy

## Overview
Roster search across the whole academy, for staff (owner, super_admin or an active trainer).

## Interface
- **`GET /api/academy/players?q=<string>`** (`players.ts:handler`): bearer JWT. `q` is optional. A request with no method passes the method check.
  - Returns 200 `{players:[{id, name, yearOfBirth, groupLabel}]}`.
  - Errors: 401 `missing_bearer` or `invalid_jwt`; 403 `forbidden`; 405 `method_not_allowed` for a method other than GET; 500; 503 `supabase_unavailable`.

## Invariants
- **Access:** the caller must be `profiles.role` `owner` or `super_admin`, or have an active `trainers` row. [players.ts:isAdmin, isTrainer]
- **Result limits:** only `children.status='active'` are returned, ordered by `full_name`, at most 30 rows. [players.ts:handler]
- **Search escaping:** `q` is trimmed, escaped with `escapeLike`, then matched with `ilike` on `full_name`. When `q` is empty or missing, no `ilike` filter is applied and the first 30 active children by `full_name` are returned. [players.ts:qEscaped]
- **Group label:** `groupLabel` uses `groups.label` and falls back to `age_group_label`. [players.ts:players]

## Side Effects
- Read-only, using the service role (bypasses RLS):
  - `fotbal.profiles`
  - `fotbal.trainers`
  - `fotbal.children`, joined with `groups`

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
