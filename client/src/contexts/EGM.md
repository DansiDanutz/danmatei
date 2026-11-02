# contexts

## Overview

React context for the light/dark theme. `client/src/App.tsx` mounts `ThemeProvider` with `defaultTheme="dark"` and `switchable`, and `client/src/components/ThemeToggle.tsx` consumes it.

## Interface

- `ThemeProvider({ children, defaultTheme = "light", switchable = false })` [ThemeContext.tsx:ThemeProvider]
- `useTheme(): { theme: "light" | "dark"; toggleTheme?: () => void; switchable: boolean }` [ThemeContext.tsx:useTheme]

## Invariants

- `useTheme` throws when called outside `ThemeProvider` [ThemeContext.tsx:useTheme]
- `toggleTheme` is `undefined` unless `switchable` is true [ThemeContext.tsx:ThemeProvider]
- The stored theme is read and written only when `switchable` is true. The stored value is cast to the theme type without validation [ThemeContext.tsx:ThemeProvider]

## Side Effects

- localStorage key `theme` (read on init, written on change, only when switchable)
- Toggles the `dark` / `light` classes and sets `style.colorScheme` on `document.documentElement`

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
