# utils

## Overview

Pure formatting helpers.

## Interface

- `formatRelativeDate(input: string | Date, locale = "ro-RO"): string`
- `initials(name: string): string`

## Invariants

- `formatRelativeDate` uses `Intl.RelativeTimeFormat(locale, { numeric: "auto" })`. It picks the unit by the size of the time difference:
  - minutes when the difference is under 60 minutes;
  - hours when it is under 24 hours;
  - days otherwise.
- `formatRelativeDate` rounds with `Math.round`. Past dates give negative values.
- `initials` splits the name on spaces and drops empty parts. It takes the first two parts and returns the uppercased first character of each.

## Side Effects

- `formatRelativeDate` reads the current time with `Date.now()`. Neither function mutates anything.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
