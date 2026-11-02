# effects

## Overview

Decorative visual effects. Currently this is a single CSS-keyframe confetti burst, used for streak milestones in `client/src/components/player/PlayerStatsHeader.tsx`.

## Interface

- `Confetti` (default) - props `{ fire: boolean; durationMs?: number = 3500; count?: number = 60 }`; renders a fixed overlay that ignores pointer events and is `aria-hidden` [Confetti.tsx:Confetti]

## Invariants

- Renders `null` when `prefers-reduced-motion: reduce` matches (checked once on mount) [Confetti.tsx:reducedMotion]
- Each fire gets a token. A hide timeout only hides the overlay if no newer burst has started [Confetti.tsx:tokenRef]
- Particle colors cycle through the 6-entry `COLORS` palette [Confetti.tsx:COLORS]

## Side Effects

- `setTimeout(durationMs)` hides the overlay; it is cleared on cleanup [Confetti.tsx:useEffect]
- Injects an inline `<style>` with `@keyframes danmateiConfettiFall` [Confetti.tsx:Confetti]

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
