# hooks

## Overview

Small generic React hooks: IME composition handling (used by `client/src/components/ui/input.tsx` and `textarea.tsx`), an animated count-up, a mobile breakpoint check, and a function wrapper whose reference never changes.

## Interface

- `useComposition<T>(options?: UseCompositionOptions<T>): UseCompositionReturn<T>` - returns `{ onCompositionStart, onCompositionEnd, onKeyDown, isComposing() }` [useComposition.ts:useComposition]
- `useCountUp({ target, duration = 1200, delay = 0, enabled = true }): { ref, value }` and `CountUpSpan({ target, duration?, delay?, className?, suffix? })` [useCountUp.tsx:useCountUp, CountUpSpan]
- `useIsMobile(): boolean` - true below 768px [useMobile.tsx:useIsMobile]
- `usePersistFn<T>(fn: T): T` - stable reference that always calls the latest `fn` [usePersistFn.ts:usePersistFn]

## Invariants

- While composing, Escape and Enter (without Shift) are stopped and do not reach the user's `onKeyDown` [useComposition.ts:onKeyDown]
- The composing flag is cleared two nested `setTimeout` ticks after `compositionend`, as a Safari workaround [useComposition.ts:onCompositionEnd]
- The count-up animates once, after the element is at least 40px inside the viewport (framer-motion `useInView`, `once: true`, `margin: "-40px"`), and only after `delay` ms [useCountUp.tsx:useCountUp]
- `useIsMobile` returns `false` until its first effect runs [useMobile.tsx:useIsMobile]

## Side Effects

- Timers in `useComposition`; in `useCountUp`, a `setTimeout(delay)` that is cleared on unmount, then a `requestAnimationFrame` loop that is not cancelled on unmount
- `window.matchMedia("(max-width: 767px)")` change listener, removed on unmount [useMobile.tsx]

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
