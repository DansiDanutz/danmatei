-- 0020_profiles_insert_self.sql
-- Fix: Google OAuth parent signup was a dead end.
--
-- fotbal.profiles has RLS enabled but had no INSERT policy. The only
-- profile-creation path was the SECURITY DEFINER trigger handle_new_user,
-- which early-returns unless raw_user_meta_data->>'app' = 'fotbal'.
-- Email/password signup passes that metadata (client/src/lib/auth.tsx signUp),
-- so the trigger fires. Google OAuth (signInWithOAuth) did NOT pass any
-- metadata, so new Google users got no profile row — and the client's
-- lazy-create upsert (auth.tsx loadProfile) + the CompleteazaProfil fallback
-- were both blocked by RLS, dead-ending onboarding at "Eroare la salvare".
--
-- This adds a self-scoped INSERT policy so an authenticated user can create
-- their OWN profile row. It is deliberately limited to role = 'parent':
-- self-serve signup only ever creates parents (auth.tsx writes role:'parent';
-- CompleteazaProfil omits role -> column default 'parent'), so this is
-- transparent to the legitimate flow while preventing a user from minting an
-- elevated role for themselves. owner/trainer/super_admin are provisioned
-- server-side (invite endpoint / service role), never via self-insert.
drop policy if exists "profiles insert self" on fotbal.profiles;
create policy "profiles insert self" on fotbal.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'parent');
