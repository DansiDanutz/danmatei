# shared

## Overview

Isomorphic constants and date helpers shared by the web client (`@shared/*` alias) and the serverless `api/` handlers (relative `../shared/date.js` imports).

## Interface

- `const.ts:COOKIE_NAME` = `"app_session_id"`; `const.ts:ONE_YEAR_MS` = one year in ms. Re-exported by `client/src/const.ts`.
- `date.ts:dobParts(dob: string | Date): { year; month; day }`
- `date.ts:birthYearFromDob(dob: string | Date): number` (equals `dobParts(dob).year`)
- Importers of `date.ts`: `api/groups.ts`, `api/match/squad.ts`, `api/enrollment/created.ts`, `api/academy/players.ts`, `client/src/lib/age.ts`, and client components in `admin/`, `cunoaste/`, `trainer/`.

## Invariants

- `dobParts` parses strings starting with `YYYY-MM-DD` literally (no `Date` construction, so no timezone shift; month is 1-based).
- Other strings go through `new Date(...)`; `Date` inputs use UTC getters (`getUTCFullYear`, `getUTCMonth() + 1`, `getUTCDate`).
- No validation: unparsable input yields `NaN` fields rather than throwing.

## Side Effects

- None.

## Verification

- `pnpm test` (includes `tests/lib/age.test.ts`, which imports `shared/date`)
