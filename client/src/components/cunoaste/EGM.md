# cunoaste

## Overview

The public "Cunoaște" swipe deck rendered by `client/src/pages/Cunoaste.tsx`. It has three slides: founder, trainers, and players/age groups. On desktop the deck is an Embla carousel. On mobile only the active slide is mounted and touch swipes switch slides. Founder and trainer content comes from `client/src/data/landing.ts`. The live age groups come from `/api/groups`.

## Interface

- `CunoasteDeck` (default, no props) - top-level 3-slide deck (`SLIDE_LABELS` = Fondator / Antrenori / Jucători) [CunoasteDeck.tsx:CunoasteDeck]
- `SlideShell` (default) - shared slide frame; props `{index, total, eyebrow, title, subtitle?, ctaLabel?='Înscrie copilul', ctaHref?='/programare', accent, children}` [SlideShell.tsx:SlideShell]
- `SlideOwner` (default, no props) - founder video `/TheBoss.mp4`, quote, `OWNER.stats`, `OWNER.reasons` [SlideOwner.tsx:SlideOwner]
- `SlideTrainers` (default, no props) - nested Embla carousel of `TRAINERS` with WhatsApp links [SlideTrainers.tsx:SlideTrainers]
- `SlidePlayers` (default, no props) - age-group cards from `/api/groups`, with quick-jump chips [SlidePlayers.tsx:SlidePlayers]
- `TrainerVideo` (default) - props `{src, poster, ageRange?}` [TrainerVideo.tsx:TrainerVideo]
- `PortraitFrame` (default) - props `{initials, accent?, imageSrc?, className?}`; falls back to initials when the image fails to load [PortraitFrame.tsx:PortraitFrame]

## Invariants

- The outer deck ignores drags and swipes that start inside `[data-deck-nested]`, which is the trainer carousel [CunoasteDeck.tsx:watchDeckDrag, handleSwipeEnd]
- A mobile swipe needs `|dx| >= 50px` and `|dx| > 1.2*|dy|`. The slide index is clamped to the slide range [CunoasteDeck.tsx:handleSwipeEnd]
- The trainer carousel moves exactly one card per gesture [SlideTrainers.tsx:watchDrag]
- Groups are never invented: only live API groups are shown. The `EDITORIAL` map (from `AGE_GROUPS`) only adds copy to groups whose code matches [SlidePlayers.tsx:EDITORIAL, fromApi]
- Group fetch: a non-OK or non-JSON response counts as a failure. Retries up to `MAX_ATTEMPTS = 3`. The result is cached at module level, and the cache is cleared on failure [SlidePlayers.tsx:fetchGroupsOnce, loadGroups]
- Logged-out users, `owner` and `super_admin` see all groups. Other logged-in users see only the groups of their active children. If that query fails, all groups are shown [SlidePlayers.tsx:SlidePlayers]
- Videos freeze on the poster 1s before the end [SlideOwner.tsx:onTimeUpdate; TrainerVideo.tsx:onTimeUpdate]

## Side Effects

- HTTP GET `/api/groups` (`cache: 'no-store'`), with retry and backoff [SlidePlayers.tsx:fetchGroupsOnce]
- Supabase read `children` (`group_id, dob`, `status='active'`, RLS-scoped) [SlidePlayers.tsx:SlidePlayers]
- Window `keydown` listener (ArrowLeft/ArrowRight); touch handlers; Embla event subscriptions [CunoasteDeck.tsx:onKey]
- Video playback from `client/public` assets; external `wa.me` links built by `buildWhatsAppLink` (`client/src/lib/whatsapp.ts`)

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
