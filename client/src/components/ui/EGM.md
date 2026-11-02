# ui

## Overview

Design-system primitives. Most files are stock shadcn/ui (new-york) wrappers over Radix UI and related libraries. They add a `data-slot` attribute to each part and merge caller classes through `cn()` from `client/src/lib/utils.ts`. A few files are custom DansLab brand primitives, and a few stock files have been modified to handle IME composition.

## Interface

- **Stock shadcn wrappers**: `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge` (`badgeVariants`), `breadcrumb`, `button` (`buttonVariants`), `button-group`, `calendar` (react-day-picker), `card`, `carousel` (embla-carousel-react), `chart` (recharts), `checkbox`, `collapsible`, `command` (cmdk), `context-menu`, `drawer` (vaul), `dropdown-menu`, `empty`, `field`, `form` (react-hook-form), `hover-card`, `input-group`, `input-otp`, `item`, `kbd`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable` (react-resizable-panels), `scroll-area`, `select`, `separator`, `sheet`, `sidebar` (`useSidebar`), `slider`, `spinner`, `switch`, `table`, `tabs`, `toggle` (`toggleVariants`), `toggle-group`, `tooltip`
- **Modified stock files**:
  - `dialog.tsx` adds `useDialogComposition` and a composition context [dialog.tsx:useDialogComposition]
  - `input.tsx` and `textarea.tsx` integrate with `useComposition` (`client/src/hooks/useComposition.ts`) [input.tsx:Input; textarea.tsx:Textarea]
  - `button.tsx` has small class changes [button.tsx:buttonVariants]
  - `sidebar.tsx` adds a `disableTransition` prop [sidebar.tsx:Sidebar]
  - `sonner.tsx` `Toaster` takes its theme from `next-themes` [sonner.tsx:Toaster]
- **Custom (not shadcn)**:
  - `BrandSpinner` (`size: xs|sm|md|lg`, aria-label "Se încarcă") [brand-spinner.tsx:BrandSpinner]
  - `BrandedField` (`label, htmlFor?, error?, hint?, required?, children`; no `className`) [branded-field.tsx:BrandedField]
  - `EmptyState` (`icon?, title, description?, action?, tone?: default|cyan|gold`) [empty-state.tsx:EmptyState]
  - `SectionCard` (`hover?, tone?: default|elevated`) [section-card.tsx:SectionCard]
  - `Skeleton`, `SkeletonCard`, `SkeletonRow` [skeleton.tsx:Skeleton]

## Invariants

- Some hooks throw when used outside their provider:
  - `useCarousel` must be inside `<Carousel>` [carousel.tsx:useCarousel]
  - `useChart` must be inside `<ChartContainer>` [chart.tsx:useChart]
  - `useSidebar` must be inside `<SidebarProvider>` [sidebar.tsx:useSidebar]
- `useFormField` expects `<Form>`, `<FormField>` and `<FormItem>` ancestors. Its "within FormField" guard never fires, because the context default is `{}` [form.tsx:useFormField]
- The caller's `className` is merged last via `cn()` and therefore wins. Exceptions: `BrandSpinner`, `SectionCard`, `Skeleton` and `EmptyState` build class strings by concatenation, so conflicting Tailwind classes are not deduplicated (`EmptyState` takes no className at all). `BrandedField` also takes no className
- Composition handling:
  - While an IME is composing, `DialogContent` ignores Escape [dialog.tsx:handleEscapeKeyDown]
  - While an IME is composing, or within 150ms after composition ended inside a Dialog, `Input` stops Enter from reaching the consumer's `onKeyDown`, and `Textarea` does the same for Enter without Shift. Other Enter presses pass through [input.tsx:Input; textarea.tsx:Textarea; dialog.tsx:useDialogComposition]
  - Outside a Dialog, `useDialogComposition` falls back to no-op defaults
- Sidebar constants:
  - `SIDEBAR_COOKIE_NAME = 'sidebar_state'`, max-age 7 days
  - Widths 16rem / 18rem (mobile) / 3rem (icon)
  - Shortcut Ctrl/Cmd+B [sidebar.tsx]
- `ChartConfig` entries set either `color` or `theme` (light/dark), not both [chart.tsx:ChartConfig]

## Side Effects

- `ChartStyle` injects a `<style>` element with `--color-<key>` variables scoped to `[data-chart=<id>]` [chart.tsx:ChartStyle]
- `SidebarProvider` writes the `sidebar_state` cookie and adds a window `keydown` listener [sidebar.tsx:SidebarProvider]
- `Carousel` listens for ArrowLeft/ArrowRight on its root [carousel.tsx:Carousel]
- Dialog, sheet, drawer, popover, select, menu and tooltip content renders into portals
- Composition timers: 150ms in `dialog.tsx` and 100ms in `input.tsx` / `textarea.tsx`

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
