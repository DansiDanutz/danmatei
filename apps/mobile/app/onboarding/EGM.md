# app/onboarding

## Overview

The `/onboarding` route. It is a static screen that shows a branded hero and one card per onboarding slide, with buttons that go to login or registration.

## Interface

- Default export `Onboarding` (`index.tsx`).
- Imports `onboardingSlides` from `@/features/onboarding/slides` and uses the slide fields `id`, `accent`, `titleRo` and `bodyRo`.
- Imports `Button`, `Card` and `Screen` from `@danmatei/ui`.

## Invariants

- Renders one `Card` per entry in `onboardingSlides`, keyed by `slide.id`.
- The button "Intră în cont" calls `router.push("/auth/login")`. The button "Creează cont nou" calls `router.push("/auth/register")`.
- The screen has no session check and no redirect logic.

## Side Effects

- Navigation with `router.push`. No network or storage access.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
