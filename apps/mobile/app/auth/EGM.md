# app/auth

## Overview

Expo Router screens for login, registration and password reset. Each screen is a react-hook-form form validated with the zod schemas from `features/auth`. On submit it calls `authService` and then navigates.

## Interface

| Route | Default export | Form fields | Schema |
| --- | --- | --- | --- |
| `/auth/login` | `Login` | `email`, `password` | `loginSchema` |
| `/auth/register` | `Register` | `email`, `password`, `confirmPassword` | `registerSchema` |
| `/auth/forgot-password` | `ForgotPassword` | `email` | `forgotPasswordSchema` |

- All screens import `authService` from `@/features/auth/auth-service`. They also import `Button`, `Input` and `Screen` from `@danmatei/ui`.
- Links between screens:
  - Login links to `/auth/forgot-password` and `/auth/register`.
  - Register links to `/auth/login`.
  - ForgotPassword links to `/auth/login`.

## Invariants

- Every form uses `zodResolver(<schema>)`, so `onSubmit` runs only after validation passes.
- Login calls `router.replace("/tabs/home")` only after `authService.signIn` resolves. On an error it shows the alert "Autentificare eșuată" and stays on the screen.
- Register sends only `email` and `password` to `authService.signUp`; `confirmPassword` is not sent. On success it shows the alert "Cont creat" and then calls `router.replace("/auth/login")`.
- ForgotPassword calls `router.back()` only after `authService.resetPassword` resolves.
- `submitting` is set before the service call and cleared in `finally`. It drives `Button loading`.
- In error alerts, the message is `error.message` when the error is an `Error`, otherwise "Încearcă din nou.".

## Side Effects

- Network calls through `authService.signIn`, `authService.signUp` and `authService.resetPassword` to Supabase Auth.
- Navigation with `router.replace` or `router.back`.
- Native `Alert.alert` dialogs.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
