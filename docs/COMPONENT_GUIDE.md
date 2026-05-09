# Component Guide

Shared mobile UI primitives live in `packages/ui` and are imported as `@danmatei/ui`. Feature-specific components belong in `apps/mobile/src/components/{ui,layout,cards,forms}/`.

## Primitives in `@danmatei/ui`

| Component | Purpose | Key props |
| --- | --- | --- |
| `Button` | Primary action button with variants | `variant: "primary" \| "secondary" \| "ghost" \| "danger"`, `size`, `loading` |
| `Card` | Rounded container with optional shadow | `elevated` |
| `Input` | Text input with label + error states | `label`, `error` |
| `Screen` | Safe-area wrapper with optional scroll/padding | `scroll`, `padded` |
| `Avatar` | Circular avatar with image or initials fallback | `uri`, `name`, `size` |

## Conventions

1. **Mobile-first.** Components must work without a hover state, mouse, or window resize.
2. **Safe-area aware.** Top-level screens must use `<Screen>` (or `SafeAreaView`) so notches and home indicators don't clip content.
3. **Accessibility built in.** Always set `accessibilityRole`, `accessibilityState`, and labels on interactive elements.
4. **Style via NativeWind.** Use `className` strings; avoid inline `style` except for dynamic dimensions.
5. **No data fetching in primitives.** Lifting up: feature components own queries, primitives stay dumb.
6. **States.** Every async screen renders loading, empty, and error explicitly — never just a spinner forever.

## Adding a new primitive

1. Create `packages/ui/MyThing.tsx` — pure RN, no app-level imports.
2. Re-export from `packages/ui/index.ts`.
3. Document above.
4. Storybook is not wired — preview by importing into a screen.

## Adding a feature-level component

1. Place under `apps/mobile/src/components/<category>/`.
2. Compose primitives from `@danmatei/ui`. Avoid duplicating Button/Card/etc.
3. If it grows server-state, move it under the feature folder and let it own the query.
