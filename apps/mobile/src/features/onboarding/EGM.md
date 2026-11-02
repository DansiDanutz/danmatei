# features/onboarding

## Overview

Static onboarding slide content, written in Romanian. The `app/onboarding` screen renders it.

## Interface

- `OnboardingSlide` type: `{ id: string; titleRo: string; bodyRo: string; accent: string }`
- `onboardingSlides: OnboardingSlide[]`: three entries.

| `id` | `accent` |
| --- | --- |
| `academia` | `#f59e0b` |
| `comunitate` | `#10b981` |
| `performanta` | `#3b82f6` |

## Invariants

- None.

## Side Effects

- None.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
