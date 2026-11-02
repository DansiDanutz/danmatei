# constants

## Overview

The static color tokens the mobile app uses in code. For example, `app/tabs/_layout.tsx` takes its tab tint colors from here.

## Interface

- `colors` (`as const`):

| Key | Value |
| --- | --- |
| `brand` | `#3b82f6` |
| `brandDark` | `#1d4ed8` |
| `ink` | `#0b1020` |
| `muted` | `#64748b` |
| `surface` | `#ffffff` |
| `surfaceDark` | `#0b1020` |
| `card` | `#f8fafc` |
| `cardDark` | `#111827` |
| `success` | `#10b981` |
| `warning` | `#f59e0b` |
| `danger` | `#ef4444` |

- `ColorToken`: `keyof typeof colors`

## Invariants

- `colors` is declared `as const`, so its values are readonly literal types.
- These tokens are separate from the Tailwind theme in `apps/mobile/tailwind.config.js` and must be kept in sync by hand. They already differ: `brandDark` is `#1d4ed8`, but the Tailwind theme's darker brand shade is `brand.600` `#2563eb`, which the screens use (`text-brand-600`, `bg-brand-600`). `#1d4ed8` appears nowhere in the Tailwind theme.

## Side Effects

- None.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
