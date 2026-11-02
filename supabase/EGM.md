# supabase

## Overview

Supabase CLI project (`project_id = "danmatei"`) for the academy backend: local stack configuration (`config.toml`), dev seed data (`seed.sql`), schema migrations (`migrations/`), and pgTAP-style RLS tests (`tests/`). The domain schema is `fotbal`, exposed via the REST API alongside `public` and `graphql_public`.

## Interface

- Migrations: [./migrations/EGM.md](./migrations/EGM.md). The `fotbal` schema (tables, enums, RLS, `SECURITY DEFINER` RPCs including anon-callable `public_*` reads, triggers, storage buckets, realtime).
- `config.toml`:
  - `[api]`: `schemas = ["public", "graphql_public", "fotbal"]`, `extra_search_path = ["fotbal", "public", "extensions"]`, `max_rows = 1000`
  - `[db]`: port 54322, `major_version = 17`; `[db.migrations] enabled = true`; `[db.seed] sql_paths = ["./seed.sql"]`
  - `[auth]`: email signup on with `enable_confirmations = false`, anonymous sign-ins off, `minimum_password_length = 6`, `site_url = http://127.0.0.1:3000`
  - `[storage]`: 50MiB limit, no buckets declared here (buckets are created by migrations)
  - `[edge_runtime]`: enabled, but no `[functions.*]` entries
- `seed.sql`: seeds `auth.users`, `fotbal.profiles`, `fotbal.trainers`, `fotbal.children`, `fotbal.landing_content` (`hero`, `owner`), `fotbal.news`, `fotbal.schedule_events`. Sample accounts: one owner, three trainers, one parent, with deterministic UUIDs.
- `tests/` (test-only, not documented separately): `chat_anon_access.test.sql`, `children_access.test.sql`, `grants.test.sql`, `public_reads.test.sql`.

## Invariants

- `seed.sql` is idempotent (`on conflict ... do update` / `do nothing`). It sets `search_path = fotbal, public, extensions` and assumes the migrations are already applied.
- Seeded auth users carry `raw_user_meta_data.app = 'fotbal'`, the marker `fotbal.handle_new_user` requires before it creates a profile. Profile roles are cast to `fotbal.user_role`.
- `.gitignore` excludes `.branches`, `.temp`, `.env.keys`, `.env.local`, `.env.*.local`.

## Side Effects

- `seed.sql` writes email-confirmed users with bcrypt-hashed passwords (`crypt(..., gen_salt('bf'))`) into `auth.users` and rows into `fotbal.*` when the local DB is seeded/reset.
- See [./migrations/EGM.md](./migrations/EGM.md) for trigger, notification, storage, and realtime side effects.

## Verification

- `supabase db start` (applies migrations; seeding runs on `supabase db reset`)
- `supabase test db` (runs `supabase/tests/*.test.sql`, also run in `.github/workflows/verify.yml`)
