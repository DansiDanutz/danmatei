# Școala de Fotbal Dan Matei

Web app pentru academia de fotbal a lui Dan Matei (Cluj-Napoca).

## Stack

- **Frontend**: React 19 + Vite 7 + TypeScript + Tailwind v4 + Framer Motion + Wouter + Embla + Radix UI + RHF/Zod
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime). All DB tables live under the `fotbal` schema in the existing **Memory** project (`gvuuauzsucvhghmpdpxf`)
- **Serverless**: Vercel functions in `/api` (service-role key for privileged ops)
- **Deploy**: Vercel (`vercel.json` already configured)

## Routes

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | public | Landing card with 5s auto-redirect |
| `/cunoaste` | public | 3-card swipe deck (Owner / Trainers / Players) |
| `/login` | public | Email + password login |
| `/inregistrare` | public | Parent signup → child onboarding |
| `/dashboard` | auth | Role router (parent / trainer / owner) |
| `/copil/:childId` | parent of child + assigned trainer + owner | Child profile (Profil · Știri · Program · Arhivă · Istoric) |
| `/antrenor` | trainer | Trainer dashboard |
| `/admin` | owner | Trainers CRUD, members directory, landing editor |

## Local development

```bash
pnpm install
cp .env.example .env.local   # already created with Memory project URL + anon key
# Paste SUPABASE_SERVICE_ROLE from Supabase dashboard → Settings → API
pnpm dev                      # vite dev server on http://localhost:3000
pnpm check                    # tsc --noEmit
pnpm build                    # production bundle into dist/public
```

## Supabase setup (already done)

Migration applied to the `fotbal` schema in the Memory project:

- 12 tables: `profiles`, `trainers`, `children`, `news`, `schedule_events`, `match_results`, `match_participations`, `player_events`, `media`, `messages`, `notifications`, `landing_content`
- 9 RLS policies covering owner / trainer / parent visibility
- 3 storage buckets: `fotbal-media-private`, `fotbal-trainer-public`, `fotbal-news-public`
- Auto-profile-on-signup trigger (only fires when `raw_user_meta_data->>'app' = 'fotbal'`)
- Append-only player-events log on child insert

Re-apply migrations:

```bash
# via Supabase CLI (preferred)
supabase db push --schema fotbal

# or paste supabase/migrations/0001_init.sql into the SQL editor on
# https://supabase.com/dashboard/project/gvuuauzsucvhghmpdpxf/sql
```

## Dev login

Sign up via `/inregistrare` to create a parent. To promote your account to `owner` (so `/admin` opens), run once in the SQL editor:

```sql
update fotbal.profiles set role = 'owner' where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

To create a trainer programmatically (mimicking `/api/trainers`):

```sql
-- 1. Create the auth user via the dashboard or `auth.admin.createUser` with
--    raw_user_meta_data = {"app": "fotbal", "role": "trainer", "full_name": "..."}
-- 2. Then:
insert into fotbal.trainers (profile_id, position, bio, age_min, age_max, certifications)
values ('THE_PROFILE_UUID', 'Antrenor U10–U12', '...', 10, 12, '["UEFA B"]'::jsonb);
```

## Deploying

Push to a Vercel-linked branch. Set these in Vercel project settings → Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE` (server only)
- `VITE_APP_URL` (your production origin, used for invite redirects)

The build runs `vite build` → static SPA in `dist/public`. Files in `/api/*.ts` are deployed as Vercel serverless functions.

## Project conventions

- All UI strings are Romanian (RO).
- Brand identity is **equipment-cyan** (`#5ECBF2`, `--color-brand-cyan`). Gold is reserved for achievement signals only (trophy stat, UEFA license, certifications).
- Animation budget on `/` is exactly **5 seconds** (see `HERO_REDIRECT_MS`).
- All user-supplied media goes through signed URLs from `/api/media-sign-upload` — never expose private bucket paths in the browser.
- All DB writes outside RLS scope (creating trainers, fan-out notifications, age-group rematching) live in `/api` and call `serviceClient()`.
