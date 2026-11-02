# EGM Drift Report: 2026-11-02

Scope: all 61 `EGM.md` contracts in `danmatei/repo`, compared with the current source code.

## EGM.md

- Broken route reference: doc says docker-compose "webhook to `{API_BASE}/api/whatsapp/inbound`", but no such function exists (`api/whatsapp/` holds only `send-welcome.ts`; no other file in the repo references `whatsapp/inbound`). The compose file also sets `WEBHOOK_GLOBAL_ENABLED: "false"` (docker-compose.yml:28), so the global webhook is disabled; the doc implies it is active (docker-compose.yml:27).
- Doc: "`@assets` → `attached_assets`". The alias exists (vite.config.ts:208), but the `attached_assets/` directory does not exist in the repo.
- Doc: "The `manus-debug-collector` plugin and the dev-only runtime plugins are skipped when `NODE_ENV=production`". Only `jsxLocPlugin`/`vitePluginManusRuntime` are dropped (vite.config.ts:186-189). `vitePluginManusDebugCollector()` is always in the plugin list (vite.config.ts:195); in production only its script-tag injection is skipped (`transformIndexHtml` returns early).
- Doc: "`APP_VERSION` comes from `VERCEL_GIT_COMMIT_SHA`, falling back to `git rev-parse --short HEAD`". The code truncates the SHA to 7 chars (vite.config.ts:158) and has a third fallback, `dev-${Date.now()}` (vite.config.ts:163). The value is also injected as the `__APP_VERSION__` global via `define` (vite.config.ts:202). The doc mentions neither.
- Global invariant: "In production and preview, cron routes and webhook handlers reject requests (fail closed) when their secret (... `LEAD_LINK_SIGNING_SECRET`) is unset". For `LEAD_LINK_SIGNING_SECRET`, `isProd()` checks only `NODE_ENV === "production"` or `VERCEL_ENV === "production"` (api/_lib/sign-token.ts:23-28). In preview, `isLeadLinkSigningConfigured()` returns true and a dev fallback secret is used (api/_lib/sign-token.ts:31, 41), so it does not fail closed in preview.
- Doc: "`playwright.audit.config.ts`, `playwright.roles.config.ts`, `playwright.cta.config.ts`, `playwright.full-audit.config.ts` and `playwright.interaction-audit.config.ts` each run their own specs". `playwright.audit.config.ts` runs `full-audit`, `interaction-audit` and `preview-audit` specs (playwright.audit.config.ts:5-9), which overlap with the full-audit and interaction-audit configs. The cta, full-audit and interaction-audit configs have no `webServer` and no `baseURL` (unlike the main and audit configs, which start `pnpm dev`). No package.json script runs the cta, full-audit or interaction-audit configs.
- Global invariant: "Every env var used in `api/`, `client/`, `server/` or `services/` must be documented in `.env.example`". `check-env-example.mjs` exempts `DEV`, `NODE_ENV`, `PORT` and `VERCEL_ENV` (scripts/check-env-example.mjs:7). It also scans `docker-compose.yml` and `services/caddy/Caddyfile` (scripts/check-env-example.mjs:6). The doc mentions neither.
- Doc: "`tests/`: Vitest unit tests (`tests/api`, `tests/lib`)". There is also a top-level `tests/mobile-release-gate.test.ts`.
- code → doc: package.json scripts beyond those cited are not documented: `build` also bundles `server/index.ts` with esbuild into `dist/` (package.json:8); `start` runs `NODE_ENV=production node dist/index.js` (package.json:9); `preview`, `format`, `audit:all`, `test:e2e:audit`, `test:e2e:roles` and `test:watch` are also present. The large `pnpm.overrides` block is not mentioned either.
- code → doc: the contract says it covers `tsconfig*.json` but says nothing about them. `tsconfig.json` type-checks `client/src`, `shared` and `server` (tsconfig.json:2); `tsconfig.api.json` type-checks `api/**/*.ts`. `tsconfig.node.json` covers only `vite.config.ts` and is not run by any script.

## packages/EGM.md

No drift detected.

## packages/ui/EGM.md

- code → doc: `packages/ui/tsconfig.json` exists (its own `noEmit` config with `jsx: "react-native"`, `strict`, `noUncheckedIndexedAccess`; packages/ui/tsconfig.json:2-13). The contract does not mention it, and Verification says the package is type-checked only through `pnpm check:mobile`. No script runs this tsconfig.
- code → doc: `Screen` passes `contentContainerStyle={{ paddingBottom: 32 }}` to the wrapper when `scroll` is true (packages/ui/Screen.tsx:27). When `padded` is true it adds `px-5 py-4`, and it appends the caller `className` (Screen.tsx:26). None of this is documented, and a caller-supplied `contentContainerStyle` in `rest` overrides the padding.

## scripts/EGM.md

- Doc: "Three are wired to root `package.json` scripts". Only two script files are referenced from package.json: `check-env-example.mjs` (`check:env`, package.json:12) and `verify-production-dependencies.mjs` (`audit:all`/`audit:production`, package.json:18-19). `start-vite-local-supabase.sh` is wired from `playwright.roles.config.ts` `webServer.command`, not from package.json.
- Doc: "`start-vite-local-supabase.sh` fails with `Run supabase start first.` if the local stack values are absent". The script runs under `set -euo pipefail` (start-vite-local-supabase.sh:2), and `env_dump="$(supabase status -o env | grep -E ...)"` (line 4) exits the script with no message when `supabase status` fails or `grep` matches nothing. The `${API_URL:?...Run supabase start first.}` guards (lines 7-8) are reached only when the grep matched at least one of the two variables.
- code → doc: `verify-production-dependencies.mjs` also exits 1 when `audit.error`, `audit.signal` or `report.error` is set, even if the JSON parsed (verify-production-dependencies.mjs:26-41). It also runs pnpm with `shell: true` on Windows (line 10). The `toolchainOnly` map lists five specific advisory IDs with their allowed path prefixes (lines 59-81); the doc does not list them.

## server/EGM.md

No drift detected.

## shared/EGM.md

No drift detected.

## supabase/EGM.md

No drift detected.

## supabase/migrations/EGM.md

- Doc: "`public_match_results(p_limit default 40)` (0036)". It is introduced in 0035 (0035_public_schedule_reads.sql:66) and dropped and recreated in 0036 (0036_public_reads_by_group.sql:48-49).
- Doc: "`public_championship()` returns `json` (0038, replaced in 0039)". In 0038 it `returns table (...)` (0038_public_championship.sql:13-14). It returns `json` only from 0039 (0039_public_championship_snapshot.sql:13-14).
- Doc: "`academy_settings`, `training_templates`, `v_child_stats`, `v_trainer_inbox`, `player_skills`, and payment tables have no `anon` grants (revoked in 0023, 0024, 0032)". 0032 revokes nothing. It only grants to `authenticated, service_role` (0032_reconcile_payments_schema.sql:122). 0001 sets `alter default privileges in schema fotbal grant select on tables to anon` (0001_init.sql:332), and no migration revokes anon from `group_fees`, `child_charges` or `child_payments`. These tables therefore carry an anon SELECT grant (RLS still applies).
- code → doc: 0001 grants blanket `select on all tables in schema fotbal to anon` plus default privileges for tables (SELECT to anon) and for functions (EXECUTE to anon, authenticated, service_role) (0001_init.sql:327-333). The contract does not mention this grant model, which is why later files have to revoke anon explicitly (0023, 0024, 0026).
- code → doc: 0030 also replaces the `fotbal.media` "media insert" policy. Non-owners can insert only with `event_id`/`group_id` null, a `storage_path` under their own `<uid>/` folder, and a visible `child_id` (0030_privilege_escalation_fixes.sql:89-105). This guard is missing from the "Privilege-escalation guards" list.
- code → doc: 0024 inserts the singleton `academy_settings` row (`id = true`, `monthly_fee_ron = 0`) (0024_admin_scheduler_contracts.sql:18-20). Its RPCs `enroll_hold`, `enroll_reject` and `regenerate_trainings` revoke EXECUTE only from `anon`, not from `PUBLIC` (0024_admin_scheduler_contracts.sql:312-314). This is the same caveat the doc records for `trainer_slug_for_age` but does not list here.

## api/EGM.md

- Doc: "`POST /api/notify` ... Returns `{sent, recipients, push}`." When no recipients resolve, the handler returns `{sent: 0, recipients: []}` with no `push` field and without inserting or pushing anything (api/notify.ts:121-123).
- Doc: "The invite metadata is always `{app:'fotbal', role:'trainer'}`." The `inviteUserByEmail` `data` also carries `full_name` and `phone` (api/trainers.ts:171-176).
- Doc for `DELETE /api/trainers` lists only `{deleted:true}` and "A foreign-key-style failure returns 409". Undocumented outcomes: 404 `Trainer not found` when no `fotbal.trainers` row exists for `profileId` or its profile role is not `trainer` (api/trainers.ts:127-135), and 400 with the raw Auth error message for non-FK delete failures (api/trainers.ts:137-145).
- Side Effects for `trainers` DELETE mention only `deleteUser`; the handler first reads `fotbal.trainers` joined to `profiles!trainers_profile_id_fkey(role)` with the service client to enforce the trainer-only rule (api/trainers.ts:127-131).
- Invariant "Roles come from `fotbal.profiles.role` ... Trainer scope comes from active `fotbal.trainers` rows. [_lib/supabase.ts]" cites the wrong file: api/_lib/supabase.ts (1-70) contains only the client factories, `getUserIdFromJwt` and `getJwtFromHeader`; no role or trainer-scope lookup exists there (each handler queries `profiles`/`trainers` itself, e.g. api/notify.ts:59-71).

## api/_lib/EGM.md

- Doc: "`verifyToken` returns `null` on any failure or after expiry." `verifyToken` calls `resolveSecret()` unguarded (api/_lib/sign-token.ts:63), which throws `LEAD_LINK_SIGNING_SECRET required in production` when the secret is unset in production (api/_lib/sign-token.ts:37-39), so it throws rather than returning `null` in that case.
- Doc lists `verifyHmac` "Options: `bindTimestamp` and `checkTimestamp`". `VerifyHmacOptions` also exposes `now`, `signatureHeaders` and `timestampHeaders` (overriding the default header names) (api/_lib/webhook-hmac.ts:58-70).
- `verifyElevenLabsSignature` accepts `opts.secret` overriding `ELEVENLABS_WEBHOOK_SECRET` and `opts.now` (api/_lib/elevenlabs-signature.ts:44-46); it returns `missing_signature` when the header does not parse, before any timestamp check (api/_lib/elevenlabs-signature.ts:51-52). Not documented.
- `generateText` sends `reasoning_effort: "none"` when the base URL is Gemini, and defaults `max_tokens` to 600 and `temperature` to 0.6 (api/_lib/openai.ts:98-103). Not documented.
- `recordLeadCall` also returns 500 `call_lookup_failed` and 500 `call_insert_failed` (api/_lib/lead-call-result.ts:94-99, 154-157); the Invariants list only the 200 duplicate and 404 outcomes.
- `sendWhatsappText` also returns `reason: "missing_to_or_body"` and defaults `WHATSAPP_API_VERSION` to `v21.0` (api/_lib/whatsapp.ts:16, 44-46). Not documented.

## api/academy/EGM.md

- Error list omits 405 `method_not_allowed` for non-GET methods (api/academy/players.ts:57-58).
- `q` is optional: when it is empty or missing, no `ilike` filter is applied and the first 30 active children (by `full_name`) are returned (api/academy/players.ts:99-109). The doc presents `?q=<string>` and says `q` "is ... matched with `ilike`" without noting this.

## api/ai/EGM.md

- `webhook` doc: "Responses: 200; 202 `{matched:false}`; 400; 401; 503 ..." omits 500, returned when the `ai_conversations` lookup fails (api/ai/webhook.ts:182-184), when the update fails (api/ai/webhook.ts:256-258), and when the `notifications` insert fails with a non-`23505` error (api/ai/webhook.ts:278-280). 405 for non-POST (api/ai/webhook.ts:98-100) is also unlisted.
- `start-conversation` doc: "Returns 200 ...; 400, 401, 404, 429 or 500" omits 405 for non-POST (api/ai/start-conversation.ts:49-51).
- `webhook` Side Effects list the updated `ai_conversations` columns as "status, `ended_at`, `transcript_md`, `transcript_summary`, `duration_seconds`, `recording_url`"; the update also always writes `elevenlabs_conversation_id` (api/ai/webhook.ts:238-239), which matters when the row was matched by `share_token`.

## api/attendance/EGM.md

- Error list omits 503 `supabase_unavailable` when `serviceClient()` throws (api/attendance/confirm.ts:79-84) and 405 `method_not_allowed` for non-POST (api/attendance/confirm.ts:59-61).

## api/cron/EGM.md

- Doc: "Push is sent only after the `notifications` insert succeeds in `daily` and `weekly-digest`." For `daily` birthdays this is false: a failed batch insert is only logged (api/cron/daily.ts:186-192) and the per-kid birthday push loop runs regardless (api/cron/daily.ts:200-216). Only the RSVP-check path gates push on the insert (api/cron/daily.ts:342-357).
- `weekly-digest` doc: "sends each parent one digest covering all of their children." Parents with no activity in the period and no upcoming event are skipped (api/cron/weekly-digest.ts:265-266). The `parents` field counts all parents with active children, not those notified (api/cron/weekly-digest.ts:317). Push tag `weekly-digest-<YYYY-MM-DD>` (api/cron/weekly-digest.ts:307) is not documented.
- Return shapes differ from the doc on the early-exit paths: `weekly-digest` returns `{ok, ranAt, parents:0, notified:0}` with no `push` when there are no active children (api/cron/weekly-digest.ts:114-121); `reap-stale-calls` returns `{ok, ranAt, reaped:0}` with no `ids` when nothing is stuck (api/cron/reap-stale-calls.ts:89-91); `generate-monthly-charges` also includes `ranAt` in both its 200 and 207 bodies (doc: "200 `{ok:true, generated}`, or 207 `{ok:false, generated, failed, failures}`") (api/cron/generate-monthly-charges.ts:197-202).
- `generate-monthly-charges` doc: "The fee is the latest `group_fees` row with `effective_from <= today`" in the Bucharest month. The "today" bound is built from the Bucharest year/month but the UTC day-of-month (`new Date().getUTCDate()`), so it is not a true Bucharest date (api/cron/generate-monthly-charges.ts:107-111).
- Undocumented 500 responses: `close-overdue-accounts` `fetch_children_failed` (api/cron/close-overdue-accounts.ts:73-77); `daily` `fetch_failed` (api/cron/daily.ts:103-107); `generate-monthly-charges` `fetch_children_failed` and `fetch_fees_failed` (api/cron/generate-monthly-charges.ts:121-125, 143-147); `reap-stale-calls` on lookup or update failure (api/cron/reap-stale-calls.ts:85-87, 99-101).
- `coaching-digest`: the `coaching_tips` and `notifications` inserts are not error-checked and push is sent regardless (api/cron/coaching-digest.ts:188-220), so `delivered` counts tips even when the inserts fail. Not documented.
- `schedule-reminder` push uses tag `sched-missing-<trainerId>` (api/cron/schedule-reminder.ts:103); the doc says only "Sends Web Push". Its `notifications` insert is not error-checked before the push (api/cron/schedule-reminder.ts:99-105).
- `daily` RSVP checks skip events with no `trainer_id` and target active children with `children.trainer_id = event.trainer_id` (api/cron/daily.ts:277, 281-286). Not documented.

## api/enrollment/EGM.md

- Error list "400; 401; 403 `Not your child`; 404" omits 405 for non-POST (api/enrollment/created.ts:34-36).

## api/lead/EGM.md

- `create` responses "200 ...; 400, 429, 503 or 500" omit 405 `method_not_allowed` (api/lead/create.ts:152-154). `source` is optional and defaults to `web` (api/lead/create.ts:43); the doc lists it as a required `source` (`web|app`).
- `reply-draft` doc lists only 200 and 503 `ai_not_configured`. Undocumented outcomes: 405 (api/lead/reply-draft.ts:75-77), 401 `missing_bearer`/`invalid_jwt`/`no_profile` (api/lead/reply-draft.ts:87-89, 113-115, 144), 400 `invalid_body` (api/lead/reply-draft.ts:93-97), 503 `supabase_unavailable` (api/lead/reply-draft.ts:103-107), 429 `rate_limited` with a `Retry-After` header (api/lead/reply-draft.ts:123-128), 404 `lead_not_found` (api/lead/reply-draft.ts:156-158), 403 `forbidden` (api/lead/reply-draft.ts:165-167), and 502 `ai_generation_failed` when the LLM call fails (api/lead/reply-draft.ts:221-223).
- `status` body: the schema also requires at least one of `status` or `snoozedUntil` (refine "Provide status or snoozedUntil", api/lead/status.ts:35-37); `snoozedUntil` must be an ISO datetime or null and `note` is capped at 2000 chars (api/lead/status.ts:29-30). Not documented.
- `status` single-lead path returns 404 `lead_not_found` or 403 `forbidden` instead of the `{ok, updated, denied, ...}` body (api/lead/status.ts:152-159); in bulk, ids that do not exist appear in neither `updated` nor `denied` (api/lead/status.ts:141-149). `leadId` is set only when the request used `id`, not a one-element `ids` (api/lead/status.ts:214). Not documented.
- `status` note: when the lead has no `lead_calls` row the note is silently dropped (api/lead/status.ts:176). The doc says the note "is appended to the latest call's `summary`" without this caveat. When truncating at `MAX_SUMMARY` the code keeps the newest text and prefixes `[…]` (api/lead/status.ts:185-187).
- `reply-draft` and `status` do not use `getJwtFromHeader`; they parse the bearer with their own `/^bearer\s+/i` regex (api/lead/reply-draft.ts:86-90; api/lead/status.ts:72-76), contrary to the parent contract's statement that authenticated routes use `getJwtFromHeader`. Both read `profiles` with the service client, not the RLS client (api/lead/reply-draft.ts:131-143; api/lead/status.ts:115-123).
- `list`: `limit` defaults to 50 (api/lead/list.ts:19), and `latestCall` is the latest call with `status === 'completed'`, not simply the latest call (api/lead/list.ts:184-191). Not documented.

## api/leads/EGM.md

- Leads whose status is not in `FUNNEL_ORDER` (e.g. `failed`, which `api/cron/reap-stale-calls.ts` writes) get no rank and are excluded from every funnel step, including `new` (api/leads/analytics.ts:178-183), although they still count in `totals.total` (api/leads/analytics.ts:168). Not documented.
- `byIntent` counts every embedded `lead_calls` row with a non-null intent, so a lead with several calls is counted several times (api/leads/analytics.ts:204-212). The doc does not describe this aggregation.
- Only 403 `owner_role_required` is documented. Other outcomes: 405 `method_not_allowed` (api/leads/analytics.ts:102-104), 401 `missing_bearer`/`invalid_jwt`/`no_profile` (api/leads/analytics.ts:108, 131-133, 139), 400 `invalid_query` (api/leads/analytics.ts:111-115), 503 `supabase_unavailable` (api/leads/analytics.ts:121-126), 500 `fetch_failed` (api/leads/analytics.ts:160-164).

## api/match/EGM.md

- `photos` error list "400 `invalid_event_id`; 401; 403; 404 `event_not_found`" omits 405 `method_not_allowed` (api/match/photos.ts:62-63) and 503 `supabase_unavailable` (api/match/photos.ts:76-80).
- `squad` documents no error responses. The handler returns 405 (api/match/squad.ts:66-67), 401 `missing_bearer`/`invalid_jwt` (api/match/squad.ts:70, 89-91), 400 `invalid_event_id` (api/match/squad.ts:73-74), 503 `supabase_unavailable` (api/match/squad.ts:79-83), 404 `event_not_found` (api/match/squad.ts:105), 500 on a `match_participations` query error (api/match/squad.ts:116) and 403 `forbidden` (api/match/squad.ts:122-123).

## api/messages/EGM.md

- Doc: push "title `Mesaj nou de la <trainer>`". The name comes from the caller's `profiles.full_name` (api/messages/send.ts:166, 192), so when an owner or super_admin posts for a trainer the title carries the owner's name, not the trainer's.
- Error list omits 405 `method_not_allowed` for non-POST (api/messages/send.ts:69-71).
- Undocumented recipient logic: `audience='group'` pushes to parents of active children with `children.trainer_id = trainerId`; `audience='child'` pushes to that child's parent (api/messages/send.ts:168-185). Push body is truncated to 140 chars (api/messages/send.ts:188).

## api/news/EGM.md

- Invariant "only the first names of new children are sent to the LLM. [draft-weekly.ts:firstName]" cites the wrong symbol: the LLM prompt splits `full_name` inline (api/news/draft-weekly.ts:331-336), and `firstName` is used only by `fallbackDraft` (api/news/draft-weekly.ts:183). The prompt also sends each new child's `age_group_label` (api/news/draft-weekly.ts:334).
- The `ai_generation_failed` fallback response also includes a `detail` field with the error message (api/news/draft-weekly.ts:399-404). Not documented.
- Error list omits 405 `method_not_allowed` for non-POST (api/news/draft-weekly.ts:230-232).
- Internal helpers list ("`fallbackDraft`, `parseDraftJson`, `isoDaysAgo`, `firstName`") omits `roDate`, `compactText` and `normalizeMatchResult` (api/news/draft-weekly.ts:120-144). Source queries are capped at 15 recaps, 10 matches and 20 new children (api/news/draft-weekly.ts:281, 292, 301), and matches are included whether or not they have `match_results` (api/news/draft-weekly.ts:284-292). Not documented.

## api/push/EGM.md

- `subscribe` error list "409 ...; 400; 401" omits 500 when the existing-endpoint lookup, update or insert fails (api/push/subscribe.ts:82-84, 101-103, 113-115) and 405 for non-POST (api/push/subscribe.ts:43-45).
- `unsubscribe` lists only "500 on a DB error"; it also returns 405 (api/push/unsubscribe.ts:33-35), 401 for a missing or invalid bearer (api/push/unsubscribe.ts:44, 49-51) and 400 `Invalid body` (api/push/unsubscribe.ts:53-58).
- `vapid-key` returns 405 for non-GET (api/push/vapid-key.ts:18-20). Not documented.

## api/schedule/EGM.md

- In both `cancel` and `notify`, Web Push is sent even when the `notifications` insert fails; only `notified` depends on the insert (api/schedule/cancel.ts:205-215; api/schedule/notify.ts:184-192). The doc implies notification and push go together but does not state that push is not gated.
- The "Common errors" list omits 405 `method_not_allowed` (api/schedule/cancel.ts:61-63; api/schedule/notify.ts:68-70) and 503 `supabase_unavailable` (api/schedule/cancel.ts:81-86; api/schedule/notify.ts:82-87). `cancel` also returns 500 `save_failed` when the `schedule_events` update fails (api/schedule/cancel.ts:132-136, 151-155).
- `cancel` response shapes: a fresh cancellation returns `{ok, cancelled:true, notified, push}` where `push` is `null` when the event has no `trainer_id` or no recipients (api/schedule/cancel.ts:163-224); re-cancelling an already-cancelled event returns `{ok, cancelled:true, notified:0}` (api/schedule/cancel.ts:158-160). The doc's "Cancel returns `{ok, ..., notified}`" does not name `cancelled` or `push`. `notify` likewise returns `push: null` when there are no recipients (api/schedule/notify.ts:175-200).
- `cancel` skips all fan-out when the event has no `trainer_id` (api/schedule/cancel.ts:165). Not documented (the doc states the `no_group` refusal only for `notify`).

## api/training/EGM.md

- `recap-publish` error list "404; 429 `renotify_cooldown` ...; 500 `save_failed`; 503" omits 405 (api/training/recap-publish.ts:62-64), 401 `missing_bearer`/`invalid_jwt`/`no_profile` (api/training/recap-publish.ts:68, 93-95, 102), 400 `invalid_body` (api/training/recap-publish.ts:71-76) and 403 `forbidden` (api/training/recap-publish.ts:120-122). The 429 also sets a `Retry-After` header (api/training/recap-publish.ts:136).
- `recap-publish` returns `notified` as the recipient count whenever it notifies, even if the `notifications` insert failed (api/training/recap-publish.ts:179, 204-209, 225), and push is sent regardless of the insert result (api/training/recap-publish.ts:212-217). Not documented.
- `recap-generate` error list omits 405 (api/training/recap-generate.ts:78-79) and 503 `supabase_unavailable` (api/training/recap-generate.ts:103-109). Its 429 is `rate_limited` with a `Retry-After` header (api/training/recap-generate.ts:126-130).

## api/voice/EGM.md

- `start` error list omits 405 `method_not_allowed` (api/voice/start.ts:62-64) and 503 `supabase_unavailable` (api/voice/start.ts:90-97).
- `elevenlabs-webhook` documents only 413 and the 200 ignore/recordLeadCall outcomes. It also returns 405 (api/voice/elevenlabs-webhook.ts:209-211), 400 `body_read_failed` (api/voice/elevenlabs-webhook.ts:220), 401 with the verifier's reason (`secret_unset`, `missing_signature`, `missing_timestamp`, `timestamp_skew`, `invalid_signature`) (api/voice/elevenlabs-webhook.ts:227), 400 `invalid_json` (api/voice/elevenlabs-webhook.ts:232-234), 400 `invalid_body` on zod failure (api/voice/elevenlabs-webhook.ts:242-246) and 503 `supabase_unavailable` (api/voice/elevenlabs-webhook.ts:256-263). The ignore response for other types is `{ok:true, ignored: type ?? "unknown"}` (api/voice/elevenlabs-webhook.ts:238).
- `elevenlabs-webhook` Side Effects omit the best-effort WhatsApp message `recordLeadCall` sends to each trainer with a `TRAINER_PHONE_<ID>` env var set (api/_lib/lead-call-result.ts:211-227); the Env list therefore also omits `TRAINER_PHONE_*` and the WhatsApp vars.
- `toLeadCallResult` mapping details not in the doc: `summary` is built from `analysis.transcript_summary` plus the `child_experience` and `availability` data-collection values (api/voice/elevenlabs-webhook.ts:130-141); `nextSteps` is split on newlines or `;` with bullet prefixes stripped (api/voice/elevenlabs-webhook.ts:177-180); `recordingUrl` is always `null` (api/voice/elevenlabs-webhook.ts:199).

## api/whatsapp/EGM.md

- Error list "400; 401; 404 ...; 409 ...; 409 ...; 429" omits 405 (api/whatsapp/send-welcome.ts:81-83) and 500, returned when the claim update fails (api/whatsapp/send-welcome.ts:134-136) or the `ai_conversations` insert fails (api/whatsapp/send-welcome.ts:175-180).
- The handler never calls `getUserIdFromJwt`: the only 401 is a missing bearer (api/whatsapp/send-welcome.ts:90-91), and an invalid or expired JWT surfaces as 404 `Child not found or not owned by caller` through the RLS query (api/whatsapp/send-welcome.ts:101-114). This also contradicts the parent api/EGM.md claim that authenticated routes resolve the user with `getUserIdFromJwt`.
- A reused `ai_conversations` row is the latest one for the child regardless of who created it, so a row minted by `/api/ai/start-conversation` with the same `childId` is reused (api/whatsapp/send-welcome.ts:148-155). The doc describes reuse only as "a retry".

## apps/EGM.md

- Doc says the app "calls the REST endpoints `/api/profile` and `/api/chat/threads...`". The client does call them (`apps/mobile/src/features/profile/profile-service.ts:5-6`, `apps/mobile/src/features/chat/chat-service.ts:5-9`), but no handler for either route exists in the repo: `api/` has no `profile*` or `chat/` entry, and nothing in `api/`, `server/`, `services/` or `supabase/functions` matches `chat/threads` or `/profile`. `vercel.json:84` only rewrites `/api/(.*)` to `/api/$1`, so these requests would 404 against this repo's backend.

## apps/mobile/EGM.md

- Side Effects: "calls the REST API at `EXPO_PUBLIC_API_BASE_URL` (`/api/profile` and `/api/chat/threads...`)". Neither route is implemented anywhere in the repo's backend (`api/` has no `profile*` or `chat/`; no match for `chat/threads` in `api/`, `server/`, `services/`, `supabase/functions`), so the documented endpoints have no server counterpart.
- Code → doc: `package.json:37` declares the dependency `react-native-mmkv`, which nothing in `app/` or `src/` imports. The contract's stack list and Side Effects mention only AsyncStorage for storage.
- Code → doc: `nativewind-env.d.ts` (`/// <reference types="nativewind/types" />`) is a config file in this folder, included by `tsconfig.json:16`, and the contract does not mention it.
- Code → doc: `tailwind.config.js:30-37` also extends `borderRadius` (`xl` 16px, `2xl` 20px, `3xl` 28px) and `fontFamily.sans` (`Inter`, `system-ui`, `sans-serif`). The contract lists only the theme colors `brand`, `ink` and `surface`. No file loads an `Inter` font, even though the `expo-font` plugin is configured (`app.json:32`).

## apps/mobile/app/EGM.md

No drift detected.

## apps/mobile/app/auth/EGM.md

No drift detected.

## apps/mobile/app/onboarding/EGM.md

No drift detected.

## apps/mobile/app/tabs/EGM.md

No drift detected.

## apps/mobile/src/EGM.md

- Doc says "The modules depend on each other in this order: `features/*` -> `lib/api` -> `lib/supabase` -> `lib/config`". `features/auth` does not go through `lib/api`. It imports `lib/supabase` directly (`src/features/auth/auth-service.ts:1`, `src/features/auth/use-session.ts:2`). `features/onboarding/slides.ts` imports nothing from `lib`. Only `features/chat` and `features/profile` use `lib/api` (`chat-service.ts:1`, `profile-service.ts:1`).

## apps/mobile/src/constants/EGM.md

- Doc says "These tokens are separate from the Tailwind theme ... keep both in sync by hand". They are already out of sync. `colors.brandDark` is `#1d4ed8` (`src/constants/colors.ts:3`), and that value appears nowhere in the Tailwind theme, whose darker brand shade is `brand.600` `#2563eb` (`tailwind.config.js:16`). The app's classes use `text-brand-600` / `bg-brand-600` (for example `app/tabs/chat.tsx:67`, `app/auth/login.tsx:80`), so code colors and class colors for "brand dark" differ.

## apps/mobile/src/features/EGM.md

- Doc lists `chatService` REST calls to "`/api/chat/threads` and `/api/chat/threads/:id/messages`" and `profileService` "`GET /api/profile` and `PUT /api/profile`". These are what the client calls, but no backend handler for any of these routes exists in the repo (`api/` has no `chat/` or `profile*`; no matches in `server/`, `services/`, `supabase/functions`).

## apps/mobile/src/features/auth/EGM.md

No drift detected.

## apps/mobile/src/features/chat/EGM.md

- Interface documents `GET /api/chat/threads` and `GET`/`POST /api/chat/threads/${threadId}/messages` (`src/features/chat/chat-service.ts:5-9`). No server route implements them anywhere in the repo (`api/` has no `chat/` directory; no `chat/threads` match in `api/`, `server/`, `services/`, `supabase/functions`). The contract does not say these endpoints are unimplemented.

## apps/mobile/src/features/onboarding/EGM.md

No drift detected.

## apps/mobile/src/features/profile/EGM.md

- Interface documents `GET /api/profile` and `PUT /api/profile` (`src/features/profile/profile-service.ts:5-6`). No server route implements them in the repo (`api/` has no `profile.ts` or `profile/`; no match in `server/`, `services/`, `supabase/functions`). The Invariant "the server must enforce field permissions" therefore refers to a server that does not exist here.

## apps/mobile/src/hooks/EGM.md

- Doc says "`useMounted(): React.MutableRefObject<boolean>`". `src/hooks/use-mounted.ts:3-4` has no return annotation and returns `useRef(false)`. With the installed `@types/react` 19.2 (`useRef<T>(initialValue: T): RefObject<T>`), the inferred type is `React.RefObject<boolean>`, not `MutableRefObject<boolean>`.

## apps/mobile/src/lib/EGM.md

No drift detected.

## apps/mobile/src/stores/EGM.md

No drift detected.

## apps/mobile/src/types/EGM.md

No drift detected.

## apps/mobile/src/utils/EGM.md

No drift detected.

## client/EGM.md

No drift detected.

## client/__manus__/EGM.md

- Doc lists `_truncated?` as part of the report payload attributed to `[debug-collector.js:reportLogs]`, but `reportLogs` never sets `_truncated` (client/__manus__/debug-collector.js:730-737); only the `beforeunload` sendBeacon fallback builds a truncated payload with `_truncated: true` when the serialized payload exceeds `MAX_BEACON_SIZE = 60000` (debug-collector.js:785-796). The 60000-char beacon cap and the truncation to last 50 console / 20 network / 100 UI events are undocumented.
- Doc: "bodies larger than 10240 bytes are not captured". The 10240 cap (`maxBodyLength`) only applies to response bodies (debug-collector.js:530, 558); request bodies are always captured via `sanitizeValue(tryParseJson(init.body))` (debug-collector.js:483), where strings are only truncated to 1000 chars and arrays to 100 items (debug-collector.js:70-79) — neither limit is documented.
- Sensitive-input masking for UI events matches on the element's `name`/`id` attribute or `type=password` only (debug-collector.js:206-220), and non-sensitive input values are logged up to `uiInputMaxLen: 200` chars; doc does not mention that non-sensitive form input values are recorded, nor the `uiInputMaxLen`/`uiTextMaxLen: 80`/`scrollThrottleMs: 500` config values (debug-collector.js:43-47).

## client/public/EGM.md

- "Media used by the app" omits `black-white.png` and `football-player.jpg`, which exist in client/public and are referenced by the app (client/src/pages/Apel.tsx:430, client/src/pages/Apel.tsx:438, client/src/pages/Programare.tsx:30).
- Side Effects lists `showNotification` "with icon `/icons/icon-192.png`" but omits that the notification also sets `badge: "/icons/icon-192.png"`, `tag` from the payload and `data.url` (client/public/sw.js:55-59); and that a non-JSON push body falls back to `event.data.text()` as the body (sw.js:44-49).
- `notificationclick` focuses an existing window only if `client.url.includes(target)` (client/public/sw.js:73) — i.e. a window already on the target URL, not any existing window as "focuses an existing window" implies; it also calls `event.notification.close()` (sw.js:65).

## client/src/EGM.md

- Doc: `mobile-preview.js` "auto-dismisses it after 12s". The 12s timer only dismisses the intro if playback has stalled (`if (video.currentTime < 0.2) dismiss()`, client/src/mobile-preview.js:147-149); a playing intro is dismissed on `ended`/`error`/skip instead (mobile-preview.js:134-141).
- Doc: "When reduced motion is on, or `IntersectionObserver` is missing, all reveal elements are shown immediately". Undocumented: `revealOnScroll` also force-reveals every `.reveal` element after a 4000 ms fallback timer even when the observer is active (client/src/mobile-preview.js:29).
- `mobile-preview.js` also runs `initFloatingCta` (toggles `#ctaPill` `.show` when `scrollY > 600`) and `initLetterReveal` (client/src/mobile-preview.js:69-75, 188, 349-357); the Interface list of effects omits the floating CTA, and Side Effects omits the `pointerdown` gesture listener (mobile-preview.js:178) and setting `document.body.style.overflow = "hidden"` while the intro is shown (mobile-preview.js:139).

## client/src/components/EGM.md

- Exported `NavItem` interface (`{href, label, icon}`) from PublicShell.tsx (client/src/components/PublicShell.tsx:52-56) and exported prop types `ChatThreadProps`, `HeroChantCardProps`, `PublicShellProps`, `TrainerAIPanelProps` are not mentioned in the Interface.
- External links list mentions only a "`mailto:` submit [Contact.tsx]", but static `mailto:zzizzou5@yahoo.com` links also exist in CTA.tsx:175, Footer.tsx:105 and Contact.tsx:24 (all client/src/components/).
- Side Effects omit the `setInterval` timer in `FloatingBall` (client/src/components/FloatingBall.tsx:35).
- `InstallAppButton` hides itself when there is no `profile` (`if (!profile) return null`, client/src/components/InstallAppButton.tsx:~127), not merely for "anonymous users" — a signed-in user without a profile row also gets nothing. It also clears the `dm-pwa-installed` flag when `beforeinstallprompt` fires (InstallAppButton.tsx:11, 60-61), which the Side Effects entry does not state.

## client/src/components/admin/EGM.md

- Doc: "HTTP (Bearer token from `supabase.auth.getSession`)" for all listed calls. `NotificationManager` takes the token from `useAuth().session` instead (client/src/components/admin/NotificationManager.tsx:33, 80); only LeadAnalyticsTab.tsx:102, NewsManager.tsx:130 and SetTeamModal.tsx:63 call `supabase.auth.getSession()`.
- Custom charge validation is undocumented: `customChargeSchema` label 1-160 chars, amount 0..100000 RON (so a 0 RON charge is allowed), `due_date` required (client/src/components/admin/PaymentsTab.tsx:657-661).
- `AdminMatchForm` inserts matches with `approval_status: "approved"` (client/src/components/admin/ScheduleOversight.tsx:519-528); the doc says only "creates matches" and does not mention the auto-approval.
- Cover upload uses `{ upsert: true }` and the stored value is the storage path, rendered through `getPublicUrl` (client/src/components/admin/NewsManager.tsx:214-216, 277-278); also, `published_at` defaults to now when left blank (NewsManager.tsx:232-234). Neither is documented.

## client/src/components/cunoaste/EGM.md

No drift detected.

## client/src/components/effects/EGM.md

No drift detected.

## client/src/components/leads/EGM.md

- Doc: "`childAge` is optional; when present it must be an integer from 4 to 18". In code `childAge` is required: empty/null is preprocessed to `undefined` and then validated by a non-optional `z.number({ error: "Vârsta este obligatorie" })` (client/src/components/leads/LeadForm.tsx:36-43), so an empty age fails validation.
- `parentPhone` is also `.trim()`med before the length/regex checks (client/src/components/leads/LeadForm.tsx:25-30); the doc mentions trimming only for `parentName` and `childName`.

## client/src/components/notifications/EGM.md

- Doc: "Does nothing while `profile` is null". `usePushSubscription()` is called unconditionally at mount of the always-rendered bell (client/src/components/notifications/NotificationBell.tsx:29-31), deliberately so push auto-restore runs on page load, not only when the popover opens (client/src/lib/use-push-subscription.ts:257-266). This auto-enable behaviour is not mentioned.
- "Mark all as read" only updates the unread rows currently held in the (max 30) local list via `.in("id", …)` (NotificationBell.tsx:82-92), not all unread notifications of the user as "for one or all unread rows" implies.

## client/src/components/player/EGM.md

- "Imported, not local" list omits `currentAge` / `isBirthdayToday` from `client/src/lib/age` used by PlayerStatsHeader (client/src/components/player/PlayerStatsHeader.tsx:24), i.e. the header's age and birthday display logic is undocumented.

## client/src/components/trainer/EGM.md

- Doc: "`match_participations` and `attendance` upsert on `(event_id, child_id)` [MatchesTab.tsx:onSubmit]". MatchesTab.tsx never touches the `attendance` table; its submit upserts only `match_results` (onConflict `event_id`, client/src/components/trainer/MatchesTab.tsx:435-443) and `match_participations` (onConflict `event_id, child_id`, MatchesTab.tsx:449-458). The `attendance` upsert on `(event_id, child_id)` lives in AttendanceTab.tsx:171-176, 258-259.
- MatchesTab also writes `match_participations` outside onSubmit: a plain `insert` when adding a player to the squad (MatchesTab.tsx:386-389, role `starter`) and a `delete` when removing one (MatchesTab.tsx:400-407); not documented.
- Doc: "Lead status writes are limited to `routed|contacted|closed`". Snooze is a separate write through the same POST `/api/lead/status` with body `{ id, snoozedUntil }` (client/src/components/trainer/InboxAITab.tsx:378-384); snoozed leads (`snoozed_until > now`) are hidden from the inbox unless "show snoozed" is toggled (InboxAITab.tsx:270-284). The snooze mechanism and its endpoint usage are not described beyond the word "snooze".
- AttendanceTab also has a direct status setter that toggles to any of the four statuses (or null when re-selecting the same one) (client/src/components/trainer/AttendanceTab.tsx:218) and a bulk upsert (AttendanceTab.tsx:258-259); the doc describes only the tap cycle.

## client/src/components/ui/EGM.md

- Doc: "`Input` and `Textarea` stop Enter (without Shift) from reaching the consumer's `onKeyDown`". Only `Textarea` checks `!e.shiftKey` (client/src/components/ui/textarea.tsx:29); `Input` blocks Enter regardless of Shift (client/src/components/ui/input.tsx:29). In both, the block applies only while composing or within the 150 ms "just ended composing" window (input.tsx:25; dialog.tsx:41-43), not to every Enter.
- Doc: "The caller's `className` is merged last via `cn()` and therefore wins", with exceptions `BrandSpinner`, `SectionCard`, `Skeleton`, `EmptyState`. `BrandedField` also accepts no `className` at all (props `label, htmlFor, error, hint, required, children`, client/src/components/ui/branded-field.tsx:13), and its `children` prop is missing from the documented signature.

## client/src/contexts/EGM.md

No drift detected.

## client/src/data/EGM.md

No drift detected.

## client/src/hooks/EGM.md

- Doc: count-up starts "when the element enters the viewport (framer-motion `useInView`, `once: true`)". The call also passes `margin: "-40px"` (client/src/hooks/useCountUp.tsx:22), so the element must be 40px inside the viewport before animating; the start is further delayed by a `setTimeout(delay)` (useCountUp.tsx:27-40) that is not listed under Side Effects.

## client/src/lib/EGM.md

- Payment tiers: doc maps months overdue "1 = `yellow`, 2 = `orange`, 3 = `red`, 4 or more = `closed`" after a non-zero outstanding, but omits that `monthsOverdue === 0` (outstanding but the first unpaid charge is due this month or later) also yields `green` (client/src/lib/payment-status.ts:124), and that `green` is also returned with a non-zero `outstandingRon` if no unpaid charge is found (payment-status.ts:108-115).
- `useAppUpdate` side effects beyond "first check after 4s, then every 5 min" are undocumented: it re-checks on window `focus` and on `visibilitychange` to visible, and **silently calls `window.location.reload()` when the tab becomes hidden while an update is pending** (client/src/lib/use-app-update.ts:75-84); `applyUpdate()` also calls `serviceWorker.getRegistration().update()` before reloading (use-app-update.ts:96-106).
- Undocumented exported types: `ChampionshipRow`, `GroupSeed`, `MatchRow`, `GroupBlock` (client/src/lib/championship.ts:5-35), `ChargeSummary`, `PaymentSummary`, `StatusResult` (payment-status.ts:30-47), `Permission` (use-browser-notification.ts:22); and motion presets `easeOut`, `springBounce`, `springSmooth`, `springSnappy`, `dur`, `fadeIn`, `scaleIn`, `slideInLeft`, `slideInRight`, `staggerItem`, `hoverGlow` (client/src/lib/motion.ts:9-87) are covered only by "etc.".
- `signInWithGoogle` redirects to `${redirectTo ?? VITE_APP_URL ?? origin}/dashboard` and `signUp` sets `emailRedirectTo` from `VITE_APP_URL` and signs up with metadata `role: "parent"` (client/src/lib/auth.tsx:242-270); the role metadata and the `/dashboard` OAuth target are not documented.

## client/src/pages/EGM.md

- Doc lists `Copii` and `Notificari` under "**Member**" and says member dashboards are "wrapped in `MemberShell`". Both pages render inside `PublicShell` (client/src/pages/Copii.tsx:14, 68, 112; client/src/pages/Notificari.tsx:11) and are routed without any guard (client/src/App.tsx `/copii`, `/notificari`); they handle the logged-out case themselves.
- Doc: "Trainer: age range 4-25 with `ageMax >= ageMin` [Admin.tsx:newTrainerSchema; Antrenor.tsx:profileSchema]". The zod schemas only enforce 4..25 (client/src/pages/Admin.tsx:500-501, 516-517; client/src/pages/Antrenor.tsx:1550-1551); the `ageMax >= ageMin` check is a manual check in the submit handlers (Admin.tsx:592, 926; Antrenor.tsx:1583). `trainerEditSchema` (Admin.tsx:509) and `childEditSchema` (Admin.tsx:134-138) are not mentioned.
- Doc: "Public data pages skip fetching and show `LoadErrorState` when `!isSupabaseConfigured`". Only Stiri, Program, Rezultate, Turnee and Campionat do so. `Grupe` shows the static `TRAINERS` fallback with `DemoBanner` instead (client/src/pages/Grupe.tsx:49-54, 125); `Galerie` just stops loading (client/src/pages/Galerie.tsx:53) and `Academie` silently returns (client/src/pages/Academie.tsx:22); none of these three renders `LoadErrorState`.
- Doc: "`Grupe` and `Campionat` fall back to the static `TRAINERS` list and show `DemoBanner`" without conditions. `Campionat` falls back only when the DB returns no active trainers (client/src/pages/Campionat.tsx:80-84) and shows `LoadErrorState`, not the fallback, when Supabase is unconfigured (Campionat.tsx:49-52). `Grupe` falls back when unconfigured, after a 6000 ms timeout, or when no active trainers are returned (Grupe.tsx:49-60, 93-95).
- `Grupe` also reads `children` (`trainer_id`, `status='active'`) to count kids per trainer (client/src/pages/Grupe.tsx:70), and `Program` fetches only a 14-day horizon (client/src/pages/Program.tsx:77); neither detail is documented.

