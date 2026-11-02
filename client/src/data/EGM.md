# data

## Overview

Static Romanian landing-page content and the shared types for it. This is pure data with no runtime logic. It is used as fallback and editorial copy by the public pages and the `client/src/components/cunoaste` deck.

## Interface

- Types: `Reason`, `Owner`, `Trainer` (`accent: cyan|gold|navy`, `videoSrc?`, `posterSrc?`, `whatsapp?`), `Player`, `AgeGroup` [landing.ts]
- `OWNER: Owner` - founder Dan Matei: 4 reasons, 4 stats [landing.ts:OWNER]
- `TRAINERS: Trainer[]` - ids `t-kelemen`, `t-sopi`, `t-dan`, with media under `/` (e.g. `/Kely.mp4`) [landing.ts:TRAINERS]
- `AGE_GROUPS: AgeGroup[]` - codes `U7`, `U9`, `U11`, `U13`, `U15`, each with 3 sample players [landing.ts:AGE_GROUPS]
- `HERO_REDIRECT_MS = 10000` [landing.ts:HERO_REDIRECT_MS]

## Invariants

- `AgeGroup.trainerIds` reference `TRAINERS` ids. This is true of the data but not enforced in code [landing.ts:AGE_GROUPS]
- `Trainer.whatsapp` is in E.164 format. When it is absent, the UI shows a disabled placeholder. This comes from a doc comment and is not enforced [landing.ts:Trainer]

## Side Effects

- None

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
