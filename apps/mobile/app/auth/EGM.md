# app/auth

## Overview

Expo Router screens for login, registration and password reset. Each screen is a react-hook-form form validated with the zod schemas from `features/auth`. On submit it calls `authService` and then navigates.

## Interface

| Route                   | Default export   | Form fields                            | Schema                 |
| ----------------------- | ---------------- | -------------------------------------- | ---------------------- |
| `/auth/login`           | `Login`          | `email`, `password`                    | `loginSchema`          |
| `/auth/register`        | `Register`       | `email`, `password`, `confirmPassword` | `registerSchema`       |
| `/auth/forgot-password` | `ForgotPassword` | `email`                                | `forgotPasswordSchema` |
| `/auth/reset-password`  | `ResetPassword`  | `password`, `confirmPassword`          | `resetPasswordSchema`  |

- All screens import `authService` from `@/features/auth/auth-service`. They also import `Button`, `Input` and `Screen` from `@danmatei/ui`.
- Links between screens:
  - Login links to `/auth/forgot-password` and `/auth/register`.
  - Register links to `/auth/login`.
  - ForgotPassword links to `/auth/login`.
  - ResetPassword links to `/auth/forgot-password` when the link is no longer valid.

## Invariants

- Every form uses `zodResolver(<schema>)`, so `onSubmit` runs only after validation passes.
- Login calls `router.replace("/tabs/home")` only after `authService.signIn` resolves. On an error it shows the alert "Autentificare eșuată" and stays on the screen.
- Register sends only `email` and `password` to `authService.signUp`; `confirmPassword` is not sent. On success it shows the alert "Cont creat" with the body "Verifică emailul pentru confirmare, apoi autentifică-te." and then calls `router.replace("/auth/login")`. On an error it shows the alert "Înregistrare eșuată" [register.tsx:onSubmit].
- ForgotPassword, after `authService.resetPassword` resolves: on native it shows the alert "Email trimis" with the body "Verifică inboxul pentru linkul de resetare a parolei." and then calls `router.back()`; on an error it shows the alert "Eroare". On web `Alert.alert` does nothing, so it shows the same text inline ("Email trimis. Verifică inboxul…", or the error message in red) and stays on the screen without `router.back()` [forgot-password.tsx:onSubmit].
- ResetPassword is the page the password-reset email opens on web. It first calls `authService.hasSession()`: with no session (expired or already used link) it shows "Link expirat" and a link to request a new one, never the form. With a session it calls `authService.updatePassword` and then `router.replace("/tabs/home")`. An error is shown inline under the form, not with `Alert`, because `Alert.alert` does nothing on web [reset-password.tsx:onSubmit].
- Field errors shown under the inputs come from `features/auth/schemas.ts`: "Adresă de email invalidă" for `email`, "Parola trebuie să aibă cel puțin 8 caractere" for `password`, and on Register also for `confirmPassword` (same 8-character minimum), plus "Parolele nu coincid" on `confirmPassword` when the two passwords differ [schemas.ts:emailSchema, passwordSchema, registerSchema].
- `submitting` is set before the service call and cleared in `finally`. It drives `Button loading`.
- In error alerts, the message is `error.message` when the error is an `Error`, otherwise "Încearcă din nou.".

## Side Effects

- Network calls through `authService.signIn`, `authService.signUp` and `authService.resetPassword` to Supabase Auth.
- Navigation with `router.replace` or `router.back`.
- Native `Alert.alert` dialogs (web shows inline text instead on ForgotPassword and ResetPassword).

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
