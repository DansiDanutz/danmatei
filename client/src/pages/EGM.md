# pages

## Overview

Route-level screens. Each one is a default-exported page component wired to a route in `client/src/App.tsx`. There are three kinds of pages:

- Public marketing pages, wrapped in `PublicShell`
- Auth pages, wrapped in `AuthCardShell`
- Member dashboards, wrapped in `MemberShell`:
  - parent child profile
  - trainer dashboard
  - owner admin

Route guards live in `App.tsx`, not in the pages. Most pages rely on Supabase RLS for data scoping.

## Interface

- **Public**:
  - `Home`: landing page with an icon menu and a `HeroTimer` that redirects to `/cunoaste` [Home.tsx:Home]
  - `Cunoaste` (`CunoasteDeck`), `Academie`, `Grupe`, `Turnee`, `Campionat`, `Stiri`, `Program`, `Rezultate`, `Galerie`, `Contact`, `NotFound`
  - `Programare`: wraps `LeadForm` [Programare.tsx:Programare]
- **Lead call**: `Apel` (`/apel/:token`). Runs a phase state machine `idle|starting|asking_mic|live|ended|error` and an ElevenLabs conversation through `@elevenlabs/react` [Apel.tsx:Apel, Phase]
- **Auth**: `Login`, `Inregistrare` (Google OAuth), `SeteazaParola` (invite/recovery password set), `CompleteazaProfil` (name + phone)
- **Member**:
  - `Dashboard`: role router [Dashboard.tsx:Dashboard]
  - `Copii`: children directory. Rendered inside `PublicShell`, routed at `/copii` with no guard; it shows a public preview when logged out [Copii.tsx:Copii]
  - `InregistrareCopil`: child signup [InregistrareCopil.tsx:InregistrareCopil]
  - `Notificari`: notification inbox. Rendered inside `PublicShell`, routed at `/notificari` with no guard; it shows a sign-in prompt when there is no profile [Notificari.tsx:Notificari]
- **`CopilProfil`** (`/copil/:childId`): tabs `profil, stiri, program, arhiva, mesaje, plati, istoric` (default `program`), with RSVP, media gallery, parent reply and a read-only payments tab [CopilProfil.tsx:CopilProfil, ParentTab]
- **`Antrenor`**: trainer dashboard, 9 tabs `grupa, atribuiri, program, meciuri, prezenta, mesaje, profil, inbox-ai, ai` (default `inbox-ai`). Composes `client/src/components/trainer/*` and `TrainerAIPanel` [Antrenor.tsx:Antrenor, TrainerTab]
- **`Admin`**: owner dashboard, 11 tabs `antrenori, grupe, membri, risc, plati, funnel, lead-uri, stiri, program, notificari, pagina` (default `lead-uri`). Lazy-loads `client/src/components/admin/*` [Admin.tsx:Admin, AdminTab]

## Invariants

- `Dashboard` routing rules [Dashboard.tsx:Dashboard]:
  - No profile, or an incomplete profile: `/completeaza-profil`
  - `owner` or `super_admin`: `/admin`
  - `trainer`: `/antrenor`
  - Parent with 0 children: `/inregistrare/copil`
  - Parent with 1 child: `/copil/:id`
  - Parent with 2 or more children: `/copii`
  - Any other role: after 4s, shows a "stuck" card
- `CopilProfil` [CopilProfil.tsx:CopilProfil, ScheduleRowCard]:
  - A missing row (no RLS access) renders "Acces interzis"
  - `isParent` gates the sibling switcher, uploads, RSVP and replies
  - RSVP is offered only for future, non-cancelled trainings within 5 days
- `Antrenor` has no role check of its own. It requires a `trainers` row with `profile_id = profile.id`; otherwise it shows "Profil antrenor lipsă" [Antrenor.tsx:refresh]
- `Admin` has no role check of its own and relies on the `RequireRole` route guard [Admin.tsx:Admin]
- Admin group assignment uses the `assign_child_to_group` RPC, which bypasses age matching [Admin.tsx:handleAssignGroup]
- Form schemas:
  - Trainer: the zod schemas limit `ageMin` and `ageMax` to 4-25 [Admin.tsx:newTrainerSchema, trainerEditSchema; Antrenor.tsx:profileSchema]. `ageMax >= ageMin` is checked by hand in the submit handlers, not by the schemas [Admin.tsx:onSubmit; Antrenor.tsx:onSubmit]
  - Child edit (admin): `full_name` 1-120 chars, `school` at most 160, `medical_notes` at most 1000 [Admin.tsx:childEditSchema]
  - Child: `dob` must be in the past; gender `M|F|X` [InregistrareCopil.tsx:schema]
  - Profile: phone regex `^[\+]?[0-9\s\-\(\)]{8,20}$` [CompleteazaProfil.tsx:schema]
  - Password: at least `MIN_LEN = 8` and must match the confirmation [SeteazaParola.tsx:MIN_LEN]
- `SeteazaParola` deliberately has no route guard. It shows a bad-link state when the URL contains an error, or when there is still no session after a 4s grace period [SeteazaParola.tsx]
- `Apel` [Apel.tsx:CallStage]:
  - Probes the microphone before POSTing to `/api/voice/start`
  - Fails if not connected within 20s
  - `CALL_DURATION_S = 180` is a client-side mirror of the cap; the real cap is server-side
  - Sends a wrap-up nudge at 150s
- When `!isSupabaseConfigured`:
  - `Stiri`, `Program`, `Rezultate`, `Turnee` and `Campionat` skip fetching and show `LoadErrorState`
  - `Grupe` shows the static `TRAINERS` list with `DemoBanner` [Grupe.tsx]
  - `Galerie` stops loading and shows no items; `Academie` keeps the static `OWNER` data. Neither shows `LoadErrorState` [Galerie.tsx; Academie.tsx]
- `Grupe` falls back to the static `TRAINERS` list and shows `DemoBanner` when Supabase is unconfigured, when the load has not finished after 6000 ms, or when no active trainers are returned. It counts active `children` per `trainer_id` for each group [Grupe.tsx]
- `Campionat` falls back to the static `TRAINERS` list and shows `DemoBanner` only when the database returns no active trainers [Campionat.tsx]
- `Program` fetches events from now through the next 14 days [Program.tsx]

## Side Effects

- **Supabase tables**:
  - Reads: `children`, `trainers`, `profiles`, `schedule_events`, `messages`, `news`, `media`, `player_events`, `match_participations`, `match_results`, `attendance`, `child_charges`, `child_payments`, `notifications`, `landing_content`, `groups`
  - Writes:
    - insert `children`, `schedule_events`, `messages`, `media`
    - update `trainers`, `profiles`, `children`, `notifications.read_at`
    - upsert `profiles`, `landing_content`
- **Supabase RPCs**: `assign_child_to_group`, `public_championship`, `public_schedule`, `public_match_results`, `public_tournaments`
- **Storage**: `fotbal-media-private` (signed URLs, uploads), `fotbal-news-public` and `fotbal-trainer-public` (public URLs)
- **Realtime**: channel `notifications-page` (INSERT on `fotbal.notifications`) [Notificari.tsx]
- **HTTP**: POST and DELETE `/api/trainers`; POST `/api/schedule/cancel`, `/api/schedule/notify`, `/api/messages/send`, `/api/attendance/confirm`, `/api/enrollment/created`, `/api/voice/start`
- **Auth**: Google OAuth, password sign-in, `resetPasswordForEmail` (redirect to `/seteaza-parola`), `updateUser({password})`, sign-out
- **Browser**:
  - `sessionStorage.removeItem('pw-setup-pending')` [SeteazaParola.tsx]
  - `getUserMedia` microphone probe and an ElevenLabs websocket session [Apel.tsx]
  - Injects a `noindex` meta tag [NotFound.tsx]

## Verification

- Run: `pnpm test` (no unit test targets this directory directly)
- Type-check: `pnpm check:app`
- E2E: `pnpm test:e2e` (Playwright, `e2e/`)
