# @danmatei/ui

## Overview

Private React Native component library (`@danmatei/ui` v0.1.0) shipped as TypeScript source (`main`/`types` = `./index.ts`, no build step). Styled with NativeWind `className` props. Consumed by `apps/mobile` via `"@danmatei/ui": "workspace:*"`.

## Interface

Exported from `index.ts` (nothing else is public; `initialsFor` and the variant/size class maps are internal):

| Symbol | Props | Defaults / notes |
| --- | --- | --- |
| `Avatar` / `AvatarProps` | `{ uri?: string \| null; name?: string; size?: number }` | `size = 40`; renders `Image` when `uri` truthy, else initials `View` |
| `Button` / `ButtonProps` | `PressableProps & { label: string; variant?: 'primary' \| 'secondary' \| 'ghost' \| 'danger'; size?: 'sm' \| 'md' \| 'lg'; loading?: boolean }` | `forwardRef<View>`; `variant='primary'`, `size='md'` |
| `Card` / `CardProps` | `PropsWithChildren<ViewProps & { elevated?: boolean }>` | renders a `View` |
| `Input` / `InputProps` | `TextInputProps & { label?: string; error?: string }` | `forwardRef<TextInput>` (ref targets inner `TextInput`) |
| `Screen` / `ScreenProps` | `PropsWithChildren<ViewProps & { scroll?: boolean; padded?: boolean }>` | `scroll=false`, `padded=true` |

Peer dependencies (all optional): `nativewind ^4.2.3`, `react 19.2.3`, `react-native 0.86.0`, `react-native-safe-area-context 5.7.0` (`package.json`).

## Invariants

- `Avatar.tsx:initialsFor` returns `'?'` for a missing/empty name; otherwise first letters of the first two words, uppercased. Avatar is always a circle (`borderRadius = size / 2`); image `accessibilityLabel` is `Avatar pentru ${name}` or `Avatar`.
- `Button.tsx:Button` treats `disabled || loading` as disabled: sets `accessibilityRole='button'`, `accessibilityState={ disabled, busy: loading }`, adds `opacity-50`. While loading, the label is replaced by an `ActivityIndicator` (`#0b1020` for `secondary`, `#fff` otherwise).
- `Button.tsx:Button` spreads `...rest` after `className`, so a caller `className` replaces the computed classes rather than merging.
- `Card.tsx:Card` appends the caller `className`; `elevated` switches border styling to a shadow.
- `Input.tsx:Input` renders the label/error `Text` only when truthy; `error` switches the border to `border-red-500` and its `Text` has `accessibilityLiveRegion='polite'`; `placeholderTextColor` defaults to `#94a3b8` (overridable).
- `Screen.tsx:Screen` uses `SafeAreaView` with `edges=['top','left','right']` (bottom excluded); inner wrapper is `ScrollView` when `scroll`, else `View`; rest props go to the inner wrapper. The wrapper gets `flex-1`, plus `px-5 py-4` when `padded`, plus the caller `className` appended. When `scroll` is true it passes `contentContainerStyle={{ paddingBottom: 32 }}`; a caller `contentContainerStyle` in `rest` is spread after it and replaces it (`Screen.tsx:39-43`).
- Theme tokens used in class names (`brand-*`, `ink`, `surface`, `surface-dark`, `surface-cardDark`) must exist in the consumer's Tailwind/NativeWind config.

## Side Effects

- None (pure presentational components).

## Verification

- `packages/ui/package.json` defines no scripts. It is type-checked through its consumer: `pnpm check:mobile` (runs `pnpm --filter @danmatei/mobile check`).
- `packages/ui/tsconfig.json` is a standalone `noEmit` config (`jsx: "react-native"`, `strict`, `noUncheckedIndexedAccess`). No script runs it; it applies only if invoked by hand (`tsc -p packages/ui`).
- Repository test suite: `pnpm test`
