# api/enrollment

## Overview
When a parent enrolls a child, this endpoint sends a Web Push to the trainers who match the child and to the owners.

## Interface
- **`POST /api/enrollment/created`** (`created.ts:handler`): bearer JWT. Body (zod `Body`): `{childId: uuid}`. `req.body` is used as-is; a string body is not parsed.
  - Returns 200 `{notified:{trainers, owners, pushSent}}`.
  - Errors: 400; 401; 403 `Not your child`; 404; 405 for a method other than POST.

## Invariants
- **Parent only:** only the child's parent (`children.parent_id === caller`) can trigger this. There is no admin bypass. [created.ts:handler]
- **Trainer recipients:**
  - The trainer for `trainer_id ?? preferred_trainer_id`.
  - Plus the trainers of active `groups` whose `birth_year_min..birth_year_max` covers the child's birth year.
  - The list is de-duplicated. [created.ts:trainerProfileIds]
- **Owner recipients:** every `profiles` row with role `owner` or `super_admin`. [created.ts:ownerIds]

## Side Effects
- **No DB writes.** It reads `fotbal.children`, `trainers`, `groups` and `profiles` with the service role.
- **Web Push** via `sendPushToUsers`, title `Înscriere nouă`, tag `enroll-<childId>`:
  - trainers get url `/antrenor`
  - owners get url `/admin`
  - needs the VAPID env vars

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
