# api/leads

## Overview
Owner-only analytics over the lead funnel. Read-only; it returns aggregated counts only.

## Interface
- **`GET /api/leads/analytics?days=1..365`** (default 30) (`analytics.ts:handler`): bearer JWT. The `profiles.role` must be `owner` or `super_admin`, otherwise 403 `owner_role_required`.
  - Returns `{ok, days, totals:{total, contacted, closed, conversionRate}, funnel:[{status, count, drop}], bySource, byIntent, byTrainer, timeSeries}`.
  - Errors: 400 `invalid_query`; 401 `missing_bearer`, `invalid_jwt` or `no_profile`; 403 `owner_role_required`; 405 `method_not_allowed`; 500 `fetch_failed`; 503 `supabase_unavailable`.
- **`FUNNEL_ORDER`:** `new, wa_sent, calling, transcribed, routed, contacted, closed`. [analytics.ts:FUNNEL_ORDER]

## Invariants
- **Access:** only `owner` and `super_admin` can call this endpoint. [analytics.ts:handler]
- **No PII:** no lead PII columns are selected. The query reads only `status`, `source`, `assigned_trainer_id`, `created_at` and `lead_calls.intent`. [analytics.ts:handler]
- **Funnel counts** are cumulative by rank. `drop` is `round((prev - cur) * 100 / prev)`. Leads whose status is not in `FUNNEL_ORDER` (for example `failed`, written by `api/cron/reap-stale-calls.ts`) get no rank and are excluded from every funnel step, including `new`, but still count in `totals.total`. [analytics.ts:handler]
- **`byIntent`** counts every embedded `lead_calls` row with a non-null `intent`, whatever its call status, so a lead with several calls is counted several times. [analytics.ts:handler]
- **Totals:** `contacted` counts both `contacted` and `closed`. `conversionRate` is `round(closed * 100 / total)`, or 0 when there are no leads. [analytics.ts:handler]
- **Time series:** zero-filled with one bucket per UTC date. [analytics.ts:handler]

## Side Effects
- Read-only, using the service role:
  - `fotbal.profiles`
  - `fotbal.leads` with embedded `lead_calls(intent)`, where `created_at >= now - days`

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
