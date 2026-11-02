# player

## Overview

Player-profile building blocks for `client/src/pages/CopilProfil.tsx` (`/copil/:childId`). This directory contains the stats header (photo, attendance streak, 5-skill rating) and the team match list, where parents can propose matches and set scores.

## Interface

- `PlayerStatsHeader` (default) - props `{ child: {id, parent_id, full_name, dob, photo_path, age_group_label, trainer_id}; onPhotoChanged?(path) }`. Internal helpers: `StreakCard`, `SkillEditor` [PlayerStatsHeader.tsx:PlayerStatsHeader]
- `TeamMatches` (default) - props `{ childId: string; trainerId: string | null; parentId: string }`. Internal helpers: `MatchCard`, `ScoreEditor`, `ProposeForm` [TeamMatches.tsx:TeamMatches]
- Imported, not local: `Confetti` (`client/src/components/effects`), `MatchPhotos` (`client/src/components/trainer`), `TRAINING_BASES` / `OTHER_LOCATION` (`client/src/lib/locations.ts`), `currentAge` / `isBirthdayToday` (`client/src/lib/age.ts`, used by `PlayerStatsHeader` to show the age and the birthday state from `child.dob`)

## Invariants

- Only roles `trainer`, `owner` and `super_admin` can edit skills [PlayerStatsHeader.tsx:canEditSkills]
- Only the child's parent, `owner` or `super_admin` can change the photo [PlayerStatsHeader.tsx:canEditPhoto]
- Skills are clamped to 1..5 and default to 3 [PlayerStatsHeader.tsx:SkillRow, DEFAULT_SKILLS]
- Photo uploads must be `image/*` and at most 8 MB. The storage path must start with the uploader's uid: `${profile.id}/${child.id}/profile-<ts>.<ext>` [PlayerStatsHeader.tsx:onPickPhoto]
- Streak milestones are `[5, 10, 20, 50]`. Tiers: Bronz from 5, Argint from 10, Aur from 20, Legenda from 50 [PlayerStatsHeader.tsx:STREAK_MILESTONES, streakTier]
- The match list shows `approved` matches plus `proposed` matches only when `created_by === parentId`. Nothing loads without a `trainerId` [TeamMatches.tsx:load]
- Proposed matches cannot have a score edited. Scorers with `goals <= 0` are dropped [TeamMatches.tsx:MatchCard, ScoreEditor]

## Side Effects

- Supabase reads: `v_child_stats`, `player_skills`, and `schedule_events` joined with `match_results`
- Supabase writes: upsert `player_skills` (onConflict `child_id`); update `children.photo_path`
- Supabase RPCs: `set_match_score {p_event, p_our, p_opp, p_scorers}` and `propose_match {p_child, p_title, p_starts_at, p_location, p_opponent, p_notes}` [TeamMatches.tsx]
- Storage bucket `fotbal-media-private`: upload, a 4h signed URL, and removal of the orphaned file when the DB update fails [PlayerStatsHeader.tsx:PHOTO_BUCKET]
- HTTP GET `/api/match/squad?eventId=` with a Bearer token [TeamMatches.tsx:ScoreEditor]
- localStorage key `danmatei_streak_${child.id}` [PlayerStatsHeader.tsx]

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
