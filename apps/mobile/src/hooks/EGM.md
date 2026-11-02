# hooks

## Overview

Shared React hooks for the mobile app.

## Interface

- `useMounted()` (return type inferred from `useRef(false)`: `React.RefObject<boolean>` with `@types/react` 19.2): returns a ref that is `true` while the component is mounted.

## Invariants

- The ref starts as `false`. A mount effect with deps `[]` sets it to `true`, and the effect's cleanup sets it back to `false` on unmount.
- No other file in `apps/mobile` uses `useMounted`. `features/auth/use-session.ts` keeps its own local `mounted` flag instead.

## Side Effects

- Writes to the ref on mount and unmount. No I/O.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
